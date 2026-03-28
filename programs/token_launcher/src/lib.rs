use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};

declare_id!("AucLeAW92yJiJuDCmtatTcpYyWQ6VAk9HQjXFR2EAN4v");

/// Token Launch Program — Constant-product bonding curve (x·y=k) with virtual
/// SOL reserves for fair token launches. Pump.fun-style economics.
///
/// Virtual reserves set a non-zero starting price, preventing first-buyer
/// dominance. Buy and sell use the same invariant, ensuring symmetry.
#[program]
pub mod token_launcher {
    use super::*;

    /// Minimum virtual SOL (1 SOL) to prevent negligible initial pricing.
    const MIN_VIRTUAL_SOL: u64 = 1_000_000_000;
    const MAX_URI_LEN: usize = 200;
    const MIGRATION_FEE_SOL: u64 = 15_000_000; // 0.015 SOL
    const MAX_FEE_RECIPIENTS: usize = 10;

    /// Create a new token launch with constant-product bonding curve.
    ///
    /// `virtual_sol_reserves` sets curve depth and starting price:
    ///   initial_price = virtual_sol / total_supply
    /// Higher virtual SOL → higher floor price, less first-buyer advantage.
    /// Typical: 30 SOL (30_000_000_000 lamports).
    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        name: String,
        symbol: String,
        uri: String,
        initial_supply: u64,
        graduation_mcap_lamports: u64,
        virtual_sol_reserves: u64,
    ) -> Result<()> {
        require!(name.len() <= 32, LaunchError::NameTooLong);
        require!(symbol.len() <= 10, LaunchError::SymbolTooLong);
        require!(uri.len() <= MAX_URI_LEN, LaunchError::UriTooLong);
        require!(initial_supply > 0, LaunchError::ZeroSupply);
        require!(virtual_sol_reserves >= MIN_VIRTUAL_SOL, LaunchError::VirtualSolTooLow);
        require!(graduation_mcap_lamports > 0, LaunchError::ZeroGraduationThreshold);

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
        launch.virtual_sol_reserves = virtual_sol_reserves;
        launch.real_sol_reserves = 0;
        launch.real_token_reserves = initial_supply;
        launch.graduation_mcap_lamports = graduation_mcap_lamports;
        launch.is_graduated = false;
        launch.is_active = true;
        launch.is_cto_approved = false;
        launch.fee_sharing_locked = false;
        launch.created_at = Clock::get()?.unix_timestamp;
        launch.bump = ctx.bumps.launch;
        launch.fee_recipients = vec![FeeRecipient {
            recipient: ctx.accounts.creator.key(),
            bps: 10000, // 100% to creator initially
        }];

        emit!(LaunchCreated {
            creator: launch.creator,
            token_mint: launch.token_mint,
            name,
            symbol,
            initial_supply,
            virtual_sol_reserves,
            graduation_mcap: graduation_mcap_lamports,
        });

        Ok(())
    }

    /// Update fee sharing configuration.
    /// Can only be done once per the "one-time redirect" rule to prevent vamping.
    pub fn update_fee_shares(
        ctx: Context<UpdateFeeShares>,
        shares: Vec<FeeRecipient>,
    ) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        require!(!launch.fee_sharing_locked, LaunchError::FeeSharingLocked);
        require!(shares.len() > 0 && shares.len() <= MAX_FEE_RECIPIENTS, LaunchError::InvalidFeeRecipientCount);
        
        let mut total_bps: u16 = 0;
        for share in &shares {
            total_bps = total_bps.checked_add(share.bps).ok_or(LaunchError::Overflow)?;
        }
        require!(total_bps == 10000, LaunchError::InvalidFeeSplit);

        launch.fee_recipients = shares;
        launch.fee_sharing_locked = true; // Permanent lock after one update

        Ok(())
    }

    /// Propose a Community Takeover.
    /// requires evidence hash of dev abandonment.
    pub fn propose_cto(
        ctx: Context<ProposeCto>,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);
        
        // In a real app, this would trigger a platform review or DAO vote.
        // For now, we store the proposal.
        launch.pending_cto_admin = Some(ctx.accounts.proposer.key());
        launch.evidence_hash = Some(evidence_hash);

        Ok(())
    }

    /// Complete Graduation to Raydium CPMM.
    /// Deducts migration fee and marks as graduated.
    /// Implementation for actual CPMM pool creation placeholder.
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        require!(launch.real_sol_reserves >= launch.graduation_mcap_lamports, LaunchError::GraduationThresholdNotMet);
        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);

        // Deduct migration fee
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.sol_vault.to_account_info(),
                    to: ctx.accounts.migration_fee_receiver.to_account_info(),
                },
                &[&[
                    b"sol_vault",
                    launch.token_mint.as_ref(),
                    &[ctx.bumps.sol_vault],
                ]],
            ),
            MIGRATION_FEE_SOL,
        )?;

        launch.is_graduated = true;
        launch.is_active = false;

        emit!(LaunchGraduated {
            token_mint: launch.token_mint,
            real_sol_reserves: launch.real_sol_reserves,
            remaining_tokens: launch.real_token_reserves,
        });

        Ok(())
    }

    /// Buy tokens from the bonding curve.
    ///
    /// Constant-product: tokens_out = T * sol_in / (S + sol_in)
    /// where S = virtual_sol + real_sol, T = real_token_reserves.
    pub fn buy(ctx: Context<Buy>, sol_amount: u64) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        require!(launch.is_active, LaunchError::LaunchInactive);
        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);
        require!(sol_amount > 0, LaunchError::ZeroAmount);
        require!(launch.real_token_reserves > 0, LaunchError::SoldOut);

        // S = virtual_sol + real_sol
        let effective_sol = (launch.virtual_sol_reserves as u128)
            .checked_add(launch.real_sol_reserves as u128)
            .ok_or(LaunchError::Overflow)?;

        // tokens_out = T * sol_in / (S + sol_in)
        let denominator = effective_sol
            .checked_add(sol_amount as u128)
            .ok_or(LaunchError::Overflow)?;
        let tokens_out = (launch.real_token_reserves as u128)
            .checked_mul(sol_amount as u128)
            .ok_or(LaunchError::Overflow)?
            .checked_div(denominator)
            .ok_or(LaunchError::Overflow)? as u64;

        require!(tokens_out > 0, LaunchError::ZeroTokensOut);
        require!(tokens_out <= launch.real_token_reserves, LaunchError::SoldOut);

        // Transfer SOL from buyer to sol_vault
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
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.curve_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.curve_authority.to_account_info(),
                },
                &[&[
                    b"curve_authority",
                    mint_key.as_ref(),
                    &[ctx.bumps.curve_authority],
                ]],
            ),
            tokens_out,
        )?;

        launch.real_sol_reserves = launch.real_sol_reserves
            .checked_add(sol_amount).ok_or(LaunchError::Overflow)?;
        launch.real_token_reserves = launch.real_token_reserves
            .checked_sub(tokens_out).ok_or(LaunchError::Overflow)?;

        // Graduate when real SOL raised exceeds threshold
        if launch.real_sol_reserves >= launch.graduation_mcap_lamports {
            launch.is_graduated = true;
            launch.is_active = false;
            emit!(LaunchGraduated {
                token_mint: launch.token_mint,
                real_sol_reserves: launch.real_sol_reserves,
                remaining_tokens: launch.real_token_reserves,
            });
        }

        // Marginal price for event: (virtual_sol + real_sol) / real_token_reserves
        let new_eff_sol = (launch.virtual_sol_reserves as u128)
            .saturating_add(launch.real_sol_reserves as u128);
        let price = if launch.real_token_reserves > 0 {
            new_eff_sol.checked_div(launch.real_token_reserves as u128).unwrap_or(0) as u64
        } else { 0 };

        emit!(TokenPurchased {
            buyer: ctx.accounts.buyer.key(),
            token_mint: launch.token_mint,
            sol_amount,
            tokens_received: tokens_out,
            marginal_price_lamports: price,
        });

        Ok(())
    }

    /// Sell tokens back to the bonding curve.
    ///
    /// Constant-product: sol_out = S * tokens_in / (T + tokens_in)
    /// SOL returned is capped at real_sol_reserves (virtual SOL stays).
    ///
    /// Sells are allowed even after cancellation (is_active=false) so holders
    /// can reclaim SOL. Only graduation blocks sells.
    pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        require!(!launch.is_graduated, LaunchError::AlreadyGraduated);
        require!(token_amount > 0, LaunchError::ZeroAmount);

        let effective_sol = (launch.virtual_sol_reserves as u128)
            .checked_add(launch.real_sol_reserves as u128)
            .ok_or(LaunchError::Overflow)?;

        let denominator = (launch.real_token_reserves as u128)
            .checked_add(token_amount as u128)
            .ok_or(LaunchError::Overflow)?;

        let sol_out_raw = effective_sol
            .checked_mul(token_amount as u128)
            .ok_or(LaunchError::Overflow)?
            .checked_div(denominator)
            .ok_or(LaunchError::Overflow)? as u64;

        // Cap: cannot withdraw virtual SOL
        let sol_out = std::cmp::min(sol_out_raw, launch.real_sol_reserves);
        require!(sol_out > 0, LaunchError::ZeroSolOut);

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

        // Transfer SOL from sol_vault to seller via CPI with PDA signer
        let mint_key = launch.token_mint;
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.sol_vault.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
                &[&[
                    b"sol_vault",
                    mint_key.as_ref(),
                    &[ctx.bumps.sol_vault],
                ]],
            ),
            sol_out,
        )?;

        launch.real_token_reserves = launch.real_token_reserves
            .checked_add(token_amount).ok_or(LaunchError::Overflow)?;
        launch.real_sol_reserves = launch.real_sol_reserves
            .checked_sub(sol_out).ok_or(LaunchError::Overflow)?;

        emit!(TokenSold {
            seller: ctx.accounts.seller.key(),
            token_mint: launch.token_mint,
            token_amount,
            sol_received: sol_out,
        });

        Ok(())
    }

    /// Creator cancels the launch. No new buys, but sells remain open
    /// so holders can exit at the current curve price.
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
        init, payer = creator, space = Launch::LEN,
        seeds = [b"launch", token_mint.key().as_ref()], bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        constraint = curve_vault.mint == token_mint.key() @ LaunchError::InvalidMint,
        constraint = curve_vault.owner == curve_authority.key() @ LaunchError::InvalidVaultOwner,
    )]
    pub curve_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the curve — validated via seeds
    #[account(seeds = [b"curve_authority", token_mint.key().as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut, seeds = [b"launch", launch.token_mint.as_ref()], bump = launch.bump)]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        constraint = curve_vault.mint == launch.token_mint @ LaunchError::InvalidMint,
        constraint = curve_vault.owner == curve_authority.key() @ LaunchError::InvalidVaultOwner,
    )]
    pub curve_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = buyer_token_account.mint == launch.token_mint @ LaunchError::InvalidMint)]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA — validated via seeds
    #[account(mut, seeds = [b"sol_vault", launch.token_mint.as_ref()], bump)]
    pub sol_vault: SystemAccount<'info>,

    /// CHECK: Curve authority PDA — validated via seeds
    #[account(seeds = [b"curve_authority", launch.token_mint.as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, seeds = [b"launch", launch.token_mint.as_ref()], bump = launch.bump)]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        constraint = curve_vault.mint == launch.token_mint @ LaunchError::InvalidMint,
        constraint = curve_vault.owner == curve_authority.key() @ LaunchError::InvalidVaultOwner,
    )]
    pub curve_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = seller_token_account.mint == launch.token_mint @ LaunchError::InvalidMint)]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA — validated via seeds
    #[account(mut, seeds = [b"sol_vault", launch.token_mint.as_ref()], bump)]
    pub sol_vault: SystemAccount<'info>,

    /// CHECK: Curve authority PDA — for curve_vault owner validation
    #[account(seeds = [b"curve_authority", launch.token_mint.as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFeeShares<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()], bump = launch.bump,
        constraint = (launch.creator == caller.key() || launch.pending_cto_admin == Some(caller.key())) @ LaunchError::Unauthorized
    )]
    pub launch: Account<'info, Launch>,
}

#[derive(Accounts)]
pub struct ProposeCto<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()], bump = launch.bump,
    )]
    pub launch: Account<'info, Launch>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()], bump = launch.bump,
    )]
    pub launch: Account<'info, Launch>,

    /// CHECK: SOL vault PDA — validated via seeds
    #[account(mut, seeds = [b"sol_vault", launch.token_mint.as_ref()], bump)]
    pub sol_vault: SystemAccount<'info>,

    /// CHECK: Migration fee receiver (platform wallet)
    #[account(mut)]
    pub migration_fee_receiver: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelLaunch<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.token_mint.as_ref()], bump = launch.bump,
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
    pub virtual_sol_reserves: u64,           // 8
    pub real_sol_reserves: u64,              // 8
    pub real_token_reserves: u64,            // 8
    pub graduation_mcap_lamports: u64,       // 8
    pub is_graduated: bool,                  // 1
    pub is_active: bool,                     // 1
    pub is_cto_approved: bool,               // 1
    pub fee_sharing_locked: bool,            // 1
    pub created_at: i64,                     // 8
    pub bump: u8,                            // 1
    pub fee_recipients: Vec<FeeRecipient>,   // 4 + (32 + 2) * 10 = 344
    pub pending_cto_admin: Option<Pubkey>,   // 1 + 32 = 33
    pub evidence_hash: Option<[u8; 32]>,     // 1 + 32 = 33
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, Copy)]
pub struct FeeRecipient {
    pub recipient: Pubkey,
    pub bps: u16,
}

impl Launch {
    // 8 + 32 + 32 + 36 + 14 + 204 + 8*5 + 1*4 + 8 + 1 + 4 + 340 + 33 + 33 = 787
    pub const LEN: usize = 800; // Buffered size
}

// ═══════════ Events ═══════════

#[event]
pub struct LaunchCreated {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub initial_supply: u64,
    pub virtual_sol_reserves: u64,
    pub graduation_mcap: u64,
}

#[event]
pub struct TokenPurchased {
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
    pub marginal_price_lamports: u64,
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
    pub real_sol_reserves: u64,
    pub remaining_tokens: u64,
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
    #[msg("URI too long (max 200 bytes)")]
    UriTooLong,
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
    #[msg("Zero SOL out — trade too small")]
    ZeroSolOut,
    #[msg("Invalid mint — does not match launch token")]
    InvalidMint,
    #[msg("Invalid vault owner — must be curve authority PDA")]
    InvalidVaultOwner,
    #[msg("Virtual SOL too low (min 1 SOL)")]
    VirtualSolTooLow,
    #[msg("Graduation threshold must be > 0")]
    ZeroGraduationThreshold,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Fee sharing is locked (one-time redirect only)")]
    FeeSharingLocked,
    #[msg("Invalid fee recipient count (max 10)")]
    InvalidFeeRecipientCount,
    #[msg("Invalid fee split — must total 10,000 basis points")]
    InvalidFeeSplit,
    #[msg("No proposal found")]
    NoProposal,
    #[msg("Graduation threshold not met")]
    GraduationThresholdNotMet,
}
