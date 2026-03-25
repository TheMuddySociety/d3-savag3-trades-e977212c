use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("D3SFeeC011ect0r1111111111111111111111111111");

/// Fee Collection Program — collects platform fees on swaps
/// with configurable fee rates and referral revenue splits.
#[program]
pub mod fee_collector {
    use super::*;

    /// Initialize the fee config PDA.
    /// Only the platform admin can call this.
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_bps: u16,           // e.g. 50 = 0.5%
        referral_bps: u16,      // e.g. 10 = 0.1% to referrer
    ) -> Result<()> {
        require!(fee_bps <= 1000, FeeError::FeeTooHigh); // Max 10%
        require!(referral_bps <= fee_bps, FeeError::ReferralExceedsFee);

        let config = &mut ctx.accounts.fee_config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps;
        config.referral_bps = referral_bps;
        config.total_collected_lamports = 0;
        config.total_referral_paid_lamports = 0;
        config.total_transactions = 0;
        config.bump = ctx.bumps.fee_config;

        Ok(())
    }

    /// Collect fee on a swap.
    /// The caller (user) pays fee_bps of the trade amount to the treasury,
    /// and referral_bps to the referrer if provided.
    pub fn collect_fee(
        ctx: Context<CollectFee>,
        trade_lamports: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.fee_config;
        let fee_amount = (trade_lamports as u128)
            .checked_mul(config.fee_bps as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        require!(fee_amount > 0, FeeError::ZeroFee);

        // Calculate referral split
        let referral_amount = if ctx.accounts.referrer.is_some() {
            (trade_lamports as u128)
                .checked_mul(config.referral_bps as u128)
                .unwrap()
                .checked_div(10_000)
                .unwrap() as u64
        } else {
            0
        };

        let treasury_amount = fee_amount - referral_amount;

        // Transfer to treasury
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            treasury_amount,
        )?;

        // Transfer referral if applicable
        if referral_amount > 0 {
            if let Some(referrer) = &ctx.accounts.referrer {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.payer.to_account_info(),
                            to: referrer.to_account_info(),
                        },
                    ),
                    referral_amount,
                )?;
                config.total_referral_paid_lamports += referral_amount;
            }
        }

        config.total_collected_lamports += fee_amount;
        config.total_transactions += 1;

        emit!(FeeCollected {
            payer: ctx.accounts.payer.key(),
            trade_lamports,
            fee_amount,
            referral_amount,
            treasury_amount,
        });

        Ok(())
    }

    /// Update fee rates. Admin only.
    pub fn update_fees(
        ctx: Context<AdminAction>,
        fee_bps: u16,
        referral_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 1000, FeeError::FeeTooHigh);
        require!(referral_bps <= fee_bps, FeeError::ReferralExceedsFee);

        let config = &mut ctx.accounts.fee_config;
        config.fee_bps = fee_bps;
        config.referral_bps = referral_bps;

        Ok(())
    }

    /// Transfer admin to a new wallet.
    pub fn transfer_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.fee_config;
        config.admin = new_admin;
        Ok(())
    }
}

// ═══════════ Accounts ═══════════

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Treasury wallet to receive fees
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = FeeConfig::LEN,
        seeds = [b"fee_config"],
        bump
    )]
    pub fee_config: Account<'info, FeeConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CollectFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Treasury wallet
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Optional referrer
    #[account(mut)]
    pub referrer: Option<UncheckedAccount<'info>>,

    #[account(
        mut,
        seeds = [b"fee_config"],
        bump = fee_config.bump,
        constraint = fee_config.treasury == treasury.key() @ FeeError::InvalidTreasury
    )]
    pub fee_config: Account<'info, FeeConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"fee_config"],
        bump = fee_config.bump,
        constraint = fee_config.admin == admin.key() @ FeeError::Unauthorized
    )]
    pub fee_config: Account<'info, FeeConfig>,
}

// ═══════════ State ═══════════

#[account]
pub struct FeeConfig {
    pub admin: Pubkey,                      // 32
    pub treasury: Pubkey,                   // 32
    pub fee_bps: u16,                       // 2
    pub referral_bps: u16,                  // 2
    pub total_collected_lamports: u64,      // 8
    pub total_referral_paid_lamports: u64,  // 8
    pub total_transactions: u64,            // 8
    pub bump: u8,                           // 1
}

impl FeeConfig {
    pub const LEN: usize = 8 + 32 + 32 + 2 + 2 + 8 + 8 + 8 + 1;
}

// ═══════════ Events ═══════════

#[event]
pub struct FeeCollected {
    pub payer: Pubkey,
    pub trade_lamports: u64,
    pub fee_amount: u64,
    pub referral_amount: u64,
    pub treasury_amount: u64,
}

// ═══════════ Errors ═══════════

#[error_code]
pub enum FeeError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Fee too high (max 10%)")]
    FeeTooHigh,
    #[msg("Referral cut exceeds total fee")]
    ReferralExceedsFee,
    #[msg("Zero fee")]
    ZeroFee,
    #[msg("Invalid treasury")]
    InvalidTreasury,
}
