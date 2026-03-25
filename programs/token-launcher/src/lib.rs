use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};

declare_id!("D3ST0kenLaunch111111111111111111111111111111");

/// Token Launch Program — custom bonding curve for launching tokens
/// directly from the D3S app, Pump.fun style.
#[program]
pub mod token_launcher {
    use super::*;

    /// Create a new token launch with bonding curve parameters.
    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        name: String,
        symbol: String,
        uri: String,
        initial_supply: u64,
        graduation_mcap_lamports: u64,
    ) -> Result<()> {
        require!(name.len() <= 32, LaunchError::NameTooLong);
        require!(symbol.len() <= 10, LaunchError::SymbolTooLong);
        require!(initial_supply > 0, LaunchError::ZeroSupply);

        // Mint initial supply to the bonding curve vault
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.curve_vault.to_account_info(),
                    authority: ctx.accounts.curve_authority.to_account_info(),
                },
                &[&[
                    b"curve_authority",
                    ctx.accounts.token_mint.key().as_ref(),
                    &[ctx.bumps.curve_authority],
                ]],
            ),
            initial_supply,
        )?;

        let launch = &mut ctx.accounts.launch;
        launch.creator = ctx.accounts.creator.key();
        launch.token_mint = ctx.accounts.token_mint.key();
        launch.name = name.clone();
        launch.symbol = symbol.clone();
        launch.uri = uri;
        launch.total_supply = initial_supply;
        launch.tokens_sold = 0;
        launch.sol_raised = 0;
        launch.graduation_mcap_lamports = graduation_mcap_lamports;
        launch.is_graduated = false;
        launch.is_active = true;
        launch.created_at = Clock::get()?.unix_timestamp;
        launch.bump = ctx.bumps.launch;

        emit!(LaunchCreated {
            creator: launch.creator,
            token_mint: launch.token_mint,
            name,
            symbol,
            initial_supply,
            graduation_mcap: graduation_mcap_lamports,
        });

        Ok(())
    }

    /// Buy tokens from the bonding curve.
    /// Price = sol_raised / tokens_sold (linear curve).
    pub fn buy(ctx: Context<Buy>, sol_amount: u64) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        require!(launch.is_active, LaunchError::LaunchInactive);
        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);
        require!(sol_amount > 0, LaunchError::ZeroAmount);

        // Linear bonding curve: price increases as more tokens are sold
        // tokens_out = sqrt(2 * sol_amount / k + tokens_sold^2) - tokens_sold
        // Simplified: tokens_out = sol_amount * remaining / (sol_raised + sol_amount)
        let remaining = launch.total_supply - launch.tokens_sold;
        require!(remaining > 0, LaunchError::SoldOut);

        let tokens_out = if launch.sol_raised == 0 {
            // First buyer gets a base rate
            std::cmp::min(
                (sol_amount as u128 * remaining as u128 / 1_000_000_000) as u64,
                remaining,
            )
        } else {
            std::cmp::min(
                (sol_amount as u128 * remaining as u128
                    / (launch.sol_raised as u128 + sol_amount as u128)) as u64,
                remaining,
            )
        };

        require!(tokens_out > 0, LaunchError::ZeroTokensOut);

        // Transfer SOL from buyer to curve
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.sol_vault.to_account_info(),
                },
            ),
            sol_amount,
        )?;

        // Transfer tokens from curve vault to buyer
        let mint_key = launch.token_mint;
        let seeds = &[
            b"curve_authority",
            mint_key.as_ref(),
            &[ctx.bumps.curve_authority],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.curve_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.curve_authority.to_account_info(),
                },
                &[seeds],
            ),
            tokens_out,
        )?;

        launch.tokens_sold += tokens_out;
        launch.sol_raised += sol_amount;

        // Check graduation
        if launch.sol_raised >= launch.graduation_mcap_lamports {
            launch.is_graduated = true;
            launch.is_active = false;

            emit!(LaunchGraduated {
                token_mint: launch.token_mint,
                sol_raised: launch.sol_raised,
                tokens_sold: launch.tokens_sold,
            });
        }

        emit!(TokenPurchased {
            buyer: ctx.accounts.buyer.key(),
            token_mint: launch.token_mint,
            sol_amount,
            tokens_received: tokens_out,
            new_price_lamports: if launch.tokens_sold > 0 {
                launch.sol_raised / launch.tokens_sold
            } else {
                0
            },
        });

        Ok(())
    }

    /// Sell tokens back to the bonding curve.
    pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        require!(launch.is_active, LaunchError::LaunchInactive);
        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);
        require!(token_amount > 0, LaunchError::ZeroAmount);
        require!(launch.tokens_sold >= token_amount, LaunchError::ExceedsSold);

        // Calculate SOL to return (reverse bonding curve)
        let sol_out = (token_amount as u128 * launch.sol_raised as u128
            / launch.tokens_sold as u128) as u64;

        // Transfer tokens back to curve vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.curve_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Transfer SOL back to seller from vault PDA
        let mint_key = launch.token_mint;
        let seeds = &[
            b"sol_vault",
            mint_key.as_ref(),
            &[ctx.bumps.sol_vault],
        ];

        **ctx.accounts.sol_vault.to_account_info().try_borrow_mut_lamports()? -= sol_out;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_out;

        launch.tokens_sold -= token_amount;
        launch.sol_raised -= sol_out;

        emit!(TokenSold {
            seller: ctx.accounts.seller.key(),
            token_mint: launch.token_mint,
            token_amount,
            sol_received: sol_out,
        });

        Ok(())
    }

    /// Creator cancels the launch and refunds remaining SOL.
    pub fn cancel_launch(ctx: Context<CancelLaunch>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);
        launch.is_active = false;
        Ok(())
    }
}

// ═══════════ Accounts ═══════════

#[derive(Accounts)]
pub struct CreateLaunch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = Launch::LEN,
        seeds = [b"launch", token_mint.key().as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,

    /// Token account owned by curve authority PDA
    #[account(mut)]
    pub curve_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the curve
    #[account(
        seeds = [b"curve_authority", token_mint.key().as_ref()],
        bump
    )]
    pub curve_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(mut)]
    pub curve_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"sol_vault", launch.token_mint.as_ref()],
        bump
    )]
    pub sol_vault: UncheckedAccount<'info>,

    /// CHECK: Curve authority PDA
    #[account(
        seeds = [b"curve_authority", launch.token_mint.as_ref()],
        bump
    )]
    pub curve_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(mut)]
    pub curve_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"sol_vault", launch.token_mint.as_ref()],
        bump
    )]
    pub sol_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelLaunch<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()],
        bump = launch.bump,
        constraint = launch.creator == creator.key() @ LaunchError::Unauthorized
    )]
    pub launch: Account<'info, Launch>,
}

// ═══════════ State ═══════════

#[account]
pub struct Launch {
    pub creator: Pubkey,                     // 32
    pub token_mint: Pubkey,                  // 32
    pub name: String,                        // 4 + 32
    pub symbol: String,                      // 4 + 10
    pub uri: String,                         // 4 + 200
    pub total_supply: u64,                   // 8
    pub tokens_sold: u64,                    // 8
    pub sol_raised: u64,                     // 8
    pub graduation_mcap_lamports: u64,       // 8
    pub is_graduated: bool,                  // 1
    pub is_active: bool,                     // 1
    pub created_at: i64,                     // 8
    pub bump: u8,                            // 1
}

impl Launch {
    pub const LEN: usize = 8 + 32 + 32 + (4 + 32) + (4 + 10) + (4 + 200) + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 1;
}

// ═══════════ Events ═══════════

#[event]
pub struct LaunchCreated {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub initial_supply: u64,
    pub graduation_mcap: u64,
}

#[event]
pub struct TokenPurchased {
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
    pub new_price_lamports: u64,
}

#[event]
pub struct TokenSold {
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub token_amount: u64,
    pub sol_received: u64,
}

#[event]
pub struct LaunchGraduated {
    pub token_mint: Pubkey,
    pub sol_raised: u64,
    pub tokens_sold: u64,
}

// ═══════════ Errors ═══════════

#[error_code]
pub enum LaunchError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Name too long (max 32 chars)")]
    NameTooLong,
    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,
    #[msg("Zero supply")]
    ZeroSupply,
    #[msg("Launch is inactive")]
    LaunchInactive,
    #[msg("Token already graduated")]
    AlreadyGraduated,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("All tokens sold")]
    SoldOut,
    #[msg("Zero tokens out — trade too small")]
    ZeroTokensOut,
    #[msg("Sell amount exceeds tokens sold")]
    ExceedsSold,
}
