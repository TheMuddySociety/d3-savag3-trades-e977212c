use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("H96kQMaLEEXqvbqehBMqV8vdkXZV6A8y7GAzyeZDZYXQ");

/// Escrow / Budget Vault — users deposit SOL that the D3S Agent
/// can trade from, with on-chain withdrawal limits and time locks.
#[program]
pub mod escrow_vault {
    use super::*;

    /// Create a new vault for a user.
    pub fn create_vault(
        ctx: Context<CreateVault>,
        withdrawal_limit_lamports: u64,
        cooldown_slots: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.agent = ctx.accounts.agent.key();
        vault.balance_lamports = 0;
        vault.total_deposited = 0;
        vault.total_withdrawn = 0;
        vault.total_traded = 0;
        vault.withdrawal_limit_lamports = withdrawal_limit_lamports;
        vault.cooldown_slots = cooldown_slots;
        vault.last_withdrawal_slot = 0;
        vault.is_locked = false;
        vault.bump = ctx.bumps.vault;

        Ok(())
    }

    /// Deposit SOL into the vault.
    pub fn deposit(ctx: Context<Deposit>, lamports: u64) -> Result<()> {
        require!(lamports > 0, VaultError::ZeroAmount);

        // Transfer SOL from user to vault PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.vault_sol.to_account_info(),
                },
            ),
            lamports,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.balance_lamports = vault
            .balance_lamports
            .checked_add(lamports)
            .ok_or(VaultError::Overflow)?;
        vault.total_deposited = vault
            .total_deposited
            .checked_add(lamports)
            .ok_or(VaultError::Overflow)?;

        emit!(VaultDeposit {
            owner: vault.owner,
            amount: lamports,
            new_balance: vault.balance_lamports,
        });

        Ok(())
    }

    /// Withdraw SOL from the vault.
    /// Respects withdrawal limits and cooldown periods.
    pub fn withdraw(ctx: Context<Withdraw>, lamports: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(!vault.is_locked, VaultError::VaultLocked);
        require!(lamports > 0, VaultError::ZeroAmount);
        require!(
            lamports <= vault.balance_lamports,
            VaultError::InsufficientBalance
        );
        require!(
            lamports <= vault.withdrawal_limit_lamports,
            VaultError::ExceedsWithdrawalLimit
        );

        // Check cooldown
        let current_slot = Clock::get()?.slot;
        let cooldown_end = vault
            .last_withdrawal_slot
            .checked_add(vault.cooldown_slots)
            .ok_or(VaultError::Overflow)?;
        require!(current_slot >= cooldown_end, VaultError::CooldownActive);

        // Transfer SOL from vault PDA to owner via CPI with signer seeds
        let owner_key = vault.owner;
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault_sol.to_account_info(),
                    to: ctx.accounts.owner.to_account_info(),
                },
                &[&[
                    b"vault_sol",
                    owner_key.as_ref(),
                    &[ctx.bumps.vault_sol],
                ]],
            ),
            lamports,
        )?;

        vault.balance_lamports = vault
            .balance_lamports
            .checked_sub(lamports)
            .ok_or(VaultError::Overflow)?;
        vault.total_withdrawn = vault
            .total_withdrawn
            .checked_add(lamports)
            .ok_or(VaultError::Overflow)?;
        vault.last_withdrawal_slot = current_slot;

        emit!(VaultWithdrawal {
            owner: vault.owner,
            amount: lamports,
            remaining: vault.balance_lamports,
        });

        Ok(())
    }

    /// Agent spends from the vault for a trade.
    /// Only the designated agent can call this.
    /// SOL is transferred from the vault PDA to the specified destination.
    pub fn agent_spend(ctx: Context<AgentSpend>, lamports: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(!vault.is_locked, VaultError::VaultLocked);
        require!(lamports > 0, VaultError::ZeroAmount);
        require!(
            lamports <= vault.balance_lamports,
            VaultError::InsufficientBalance
        );

        // Transfer SOL from vault PDA to destination via CPI with signer seeds
        let owner_key = vault.owner;
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault_sol.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                },
                &[&[
                    b"vault_sol",
                    owner_key.as_ref(),
                    &[ctx.bumps.vault_sol],
                ]],
            ),
            lamports,
        )?;

        vault.balance_lamports = vault
            .balance_lamports
            .checked_sub(lamports)
            .ok_or(VaultError::Overflow)?;
        vault.total_traded = vault
            .total_traded
            .checked_add(lamports)
            .ok_or(VaultError::Overflow)?;

        emit!(AgentTrade {
            owner: vault.owner,
            agent: vault.agent,
            amount: lamports,
            remaining: vault.balance_lamports,
        });

        Ok(())
    }

    /// Agent returns funds (profit or partial) to the vault.
    pub fn agent_return(ctx: Context<AgentReturn>, lamports: u64) -> Result<()> {
        require!(lamports > 0, VaultError::ZeroAmount);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.agent.to_account_info(),
                    to: ctx.accounts.vault_sol.to_account_info(),
                },
            ),
            lamports,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.balance_lamports = vault
            .balance_lamports
            .checked_add(lamports)
            .ok_or(VaultError::Overflow)?;

        emit!(AgentReturnEvent {
            owner: vault.owner,
            amount: lamports,
            new_balance: vault.balance_lamports,
        });

        Ok(())
    }

    /// Emergency lock — owner can freeze the vault.
    pub fn toggle_lock(ctx: Context<OwnerAction>, locked: bool) -> Result<()> {
        ctx.accounts.vault.is_locked = locked;
        Ok(())
    }

    /// Close vault and return all remaining SOL.
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        require!(!vault.is_locked, VaultError::VaultLocked);
        require!(vault.balance_lamports == 0, VaultError::NonZeroBalance);
        Ok(())
    }
}

// ═══════════ Accounts ═══════════

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Platform agent public key — stored as-is for delegation.
    /// Validated only by the owner who chooses to trust this key.
    pub agent: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = Vault::LEN,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: SOL vault PDA — validated via seeds. Receives/holds deposited SOL.
    /// System-owned PDA; transfers use invoke_signed.
    #[account(
        mut,
        seeds = [b"vault_sol", owner.key().as_ref()],
        bump
    )]
    pub vault_sol: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ VaultError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: SOL vault PDA — validated via seeds
    #[account(
        mut,
        seeds = [b"vault_sol", owner.key().as_ref()],
        bump
    )]
    pub vault_sol: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ VaultError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: SOL vault PDA — validated via seeds. SOL transferred out via CPI.
    #[account(
        mut,
        seeds = [b"vault_sol", owner.key().as_ref()],
        bump
    )]
    pub vault_sol: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AgentSpend<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.agent == agent.key() @ VaultError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: SOL vault PDA — validated via seeds. SOL transferred out via CPI.
    #[account(
        mut,
        seeds = [b"vault_sol", vault.owner.as_ref()],
        bump
    )]
    pub vault_sol: SystemAccount<'info>,

    /// CHECK: Destination for trade SOL (e.g., DEX program, swap account).
    /// The agent is trusted to specify the correct destination.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AgentReturn<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.agent == agent.key() @ VaultError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: SOL vault PDA — validated via seeds
    #[account(
        mut,
        seeds = [b"vault_sol", vault.owner.as_ref()],
        bump
    )]
    pub vault_sol: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerAction<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ VaultError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ VaultError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,
}

// ═══════════ State ═══════════

#[account]
pub struct Vault {
    pub owner: Pubkey,                       // 32
    pub agent: Pubkey,                       // 32
    pub balance_lamports: u64,               // 8
    pub total_deposited: u64,                // 8
    pub total_withdrawn: u64,                // 8
    pub total_traded: u64,                   // 8
    pub withdrawal_limit_lamports: u64,      // 8
    pub cooldown_slots: u64,                 // 8
    pub last_withdrawal_slot: u64,           // 8
    pub is_locked: bool,                     // 1
    pub bump: u8,                            // 1
}

impl Vault {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

// ═══════════ Events ═══════════

#[event]
pub struct VaultDeposit {
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct VaultWithdrawal {
    pub owner: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct AgentTrade {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct AgentReturnEvent {
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

// ═══════════ Errors ═══════════

#[error_code]
pub enum VaultError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Insufficient vault balance")]
    InsufficientBalance,
    #[msg("Exceeds withdrawal limit")]
    ExceedsWithdrawalLimit,
    #[msg("Withdrawal cooldown active")]
    CooldownActive,
    #[msg("Vault is locked")]
    VaultLocked,
    #[msg("Vault has non-zero balance — withdraw first")]
    NonZeroBalance,
    #[msg("Arithmetic overflow")]
    Overflow,
}
