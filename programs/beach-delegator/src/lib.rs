use anchor_lang::prelude::*;

declare_id!("D3SBchDe1egator111111111111111111111111111");

/// Beach Mode Delegator — manages wallet delegation, spending caps,
/// and strategy permissions for autonomous D3S Agent trading.
#[program]
pub mod beach_delegator {
    use super::*;

    /// Initialize a new delegation session.
    /// The user authorizes the platform agent to trade on their behalf
    /// within configurable spending limits.
    pub fn initialize_delegation(
        ctx: Context<InitializeDelegation>,
        max_trade_lamports: u64,
        daily_cap_lamports: u64,
        strategies: Vec<u8>,
    ) -> Result<()> {
        let session = &mut ctx.accounts.delegation_session;
        session.owner = ctx.accounts.owner.key();
        session.agent = ctx.accounts.agent.key();
        session.max_trade_lamports = max_trade_lamports;
        session.daily_cap_lamports = daily_cap_lamports;
        session.daily_spent_lamports = 0;
        session.last_reset_slot = Clock::get()?.slot;
        session.strategies = strategies;
        session.is_active = true;
        session.total_trades = 0;
        session.total_pnl_lamports = 0;
        session.created_at = Clock::get()?.unix_timestamp;
        session.bump = ctx.bumps.delegation_session;

        emit!(DelegationCreated {
            owner: session.owner,
            agent: session.agent,
            max_trade_lamports,
            daily_cap_lamports,
        });

        Ok(())
    }

    /// Update spending limits and active strategies.
    /// Only the session owner can call this.
    pub fn update_limits(
        ctx: Context<UpdateLimits>,
        max_trade_lamports: Option<u64>,
        daily_cap_lamports: Option<u64>,
        strategies: Option<Vec<u8>>,
    ) -> Result<()> {
        let session = &mut ctx.accounts.delegation_session;

        if let Some(max) = max_trade_lamports {
            session.max_trade_lamports = max;
        }
        if let Some(cap) = daily_cap_lamports {
            session.daily_cap_lamports = cap;
        }
        if let Some(strats) = strategies {
            session.strategies = strats;
        }

        emit!(LimitsUpdated {
            owner: session.owner,
            max_trade_lamports: session.max_trade_lamports,
            daily_cap_lamports: session.daily_cap_lamports,
        });

        Ok(())
    }

    /// Record a trade execution by the agent.
    /// Validates against spending limits before marking as spent.
    pub fn record_trade(
        ctx: Context<RecordTrade>,
        trade_lamports: u64,
        strategy_id: u8,
        pnl_lamports: i64,
    ) -> Result<()> {
        let session = &mut ctx.accounts.delegation_session;

        require!(session.is_active, DelegatorError::SessionInactive);
        require!(
            trade_lamports <= session.max_trade_lamports,
            DelegatorError::ExceedsTradeLimit
        );

        // Reset daily counter if needed (~1 day of slots = 216,000 at 400ms)
        let current_slot = Clock::get()?.slot;
        if current_slot - session.last_reset_slot > 216_000 {
            session.daily_spent_lamports = 0;
            session.last_reset_slot = current_slot;
        }

        require!(
            session.daily_spent_lamports + trade_lamports <= session.daily_cap_lamports,
            DelegatorError::ExceedsDailyCap
        );

        // Validate strategy is enabled
        require!(
            session.strategies.contains(&strategy_id),
            DelegatorError::StrategyNotEnabled
        );

        session.daily_spent_lamports += trade_lamports;
        session.total_trades += 1;
        session.total_pnl_lamports += pnl_lamports;

        emit!(TradeRecorded {
            owner: session.owner,
            trade_lamports,
            strategy_id,
            pnl_lamports,
            daily_spent: session.daily_spent_lamports,
        });

        Ok(())
    }

    /// Deactivate the delegation session.
    /// Only the owner can revoke the agent's permission.
    pub fn deactivate(ctx: Context<Deactivate>) -> Result<()> {
        let session = &mut ctx.accounts.delegation_session;
        session.is_active = false;

        emit!(DelegationRevoked {
            owner: session.owner,
            total_trades: session.total_trades,
            total_pnl: session.total_pnl_lamports,
        });

        Ok(())
    }

    /// Close the session account and reclaim rent.
    pub fn close_session(_ctx: Context<CloseSession>) -> Result<()> {
        Ok(())
    }
}

// ═══════════ Accounts ═══════════

#[derive(Accounts)]
pub struct InitializeDelegation<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: The platform agent public key
    pub agent: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = DelegationSession::LEN,
        seeds = [b"delegation", owner.key().as_ref()],
        bump
    )]
    pub delegation_session: Account<'info, DelegationSession>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateLimits<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"delegation", owner.key().as_ref()],
        bump = delegation_session.bump,
        constraint = delegation_session.owner == owner.key() @ DelegatorError::Unauthorized
    )]
    pub delegation_session: Account<'info, DelegationSession>,
}

#[derive(Accounts)]
pub struct RecordTrade<'info> {
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"delegation", delegation_session.owner.as_ref()],
        bump = delegation_session.bump,
        constraint = delegation_session.agent == agent.key() @ DelegatorError::Unauthorized
    )]
    pub delegation_session: Account<'info, DelegationSession>,
}

#[derive(Accounts)]
pub struct Deactivate<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"delegation", owner.key().as_ref()],
        bump = delegation_session.bump,
        constraint = delegation_session.owner == owner.key() @ DelegatorError::Unauthorized
    )]
    pub delegation_session: Account<'info, DelegationSession>,
}

#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [b"delegation", owner.key().as_ref()],
        bump = delegation_session.bump,
        constraint = delegation_session.owner == owner.key() @ DelegatorError::Unauthorized,
        constraint = !delegation_session.is_active @ DelegatorError::SessionStillActive
    )]
    pub delegation_session: Account<'info, DelegationSession>,
}

// ═══════════ State ═══════════

#[account]
pub struct DelegationSession {
    pub owner: Pubkey,                // 32
    pub agent: Pubkey,                // 32
    pub max_trade_lamports: u64,      // 8
    pub daily_cap_lamports: u64,      // 8
    pub daily_spent_lamports: u64,    // 8
    pub last_reset_slot: u64,         // 8
    pub total_trades: u64,            // 8
    pub total_pnl_lamports: i64,      // 8
    pub created_at: i64,              // 8
    pub is_active: bool,              // 1
    pub bump: u8,                     // 1
    pub strategies: Vec<u8>,          // 4 + max 10
}

impl DelegationSession {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + (4 + 10);
}

// ═══════════ Events ═══════════

#[event]
pub struct DelegationCreated {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub max_trade_lamports: u64,
    pub daily_cap_lamports: u64,
}

#[event]
pub struct LimitsUpdated {
    pub owner: Pubkey,
    pub max_trade_lamports: u64,
    pub daily_cap_lamports: u64,
}

#[event]
pub struct TradeRecorded {
    pub owner: Pubkey,
    pub trade_lamports: u64,
    pub strategy_id: u8,
    pub pnl_lamports: i64,
    pub daily_spent: u64,
}

#[event]
pub struct DelegationRevoked {
    pub owner: Pubkey,
    pub total_trades: u64,
    pub total_pnl: i64,
}

// ═══════════ Errors ═══════════

#[error_code]
pub enum DelegatorError {
    #[msg("Unauthorized: signer does not match session owner/agent")]
    Unauthorized,
    #[msg("Session is not active")]
    SessionInactive,
    #[msg("Trade exceeds per-trade limit")]
    ExceedsTradeLimit,
    #[msg("Trade exceeds daily spending cap")]
    ExceedsDailyCap,
    #[msg("Strategy is not enabled for this session")]
    StrategyNotEnabled,
    #[msg("Session is still active — deactivate first")]
    SessionStillActive,
}
