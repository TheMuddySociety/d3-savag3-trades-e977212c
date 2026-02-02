
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				retro: {
					black: "0 0% 8%",
					red: "0 84% 60%",
					white: "0 0% 95%",
					green: "120 100% 50%"
				}
			},
			borderRadius: {
				lg: '1.5rem',
				md: '1rem',
				sm: '0.75rem'
			},
			fontFamily: {
				mono: ['"Courier New"', 'monospace'],
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'pulse-glow': {
					'0%, 100%': { 
						boxShadow: '0 0 10px rgba(255, 65, 54, 0.5), 0 0 20px rgba(255, 65, 54, 0.3), 0 0 30px rgba(255, 65, 54, 0.1)' 
					},
					'50%': { 
						boxShadow: '0 0 20px rgba(255, 65, 54, 0.8), 0 0 30px rgba(255, 65, 54, 0.6), 0 0 40px rgba(255, 65, 54, 0.4)' 
					}
				},
				'float': {
					'0%, 100%': { 
						transform: 'translateY(0px) rotate(0deg)' 
					},
					'33%': { 
						transform: 'translateY(-10px) rotate(1deg)' 
					},
					'66%': { 
						transform: 'translateY(-5px) rotate(-1deg)' 
					}
				},
				'scale-in': {
					'0%': { 
						transform: 'scale(0.9)', 
						opacity: '0' 
					},
					'100%': { 
						transform: 'scale(1)', 
						opacity: '1' 
					}
				},
				'slide-up': {
					'0%': { 
						transform: 'translateY(20px)', 
						opacity: '0' 
					},
					'100%': { 
						transform: 'translateY(0)', 
						opacity: '1' 
					}
				},
				'gradient-shift': {
					'0%, 100%': { 
						backgroundPosition: '0% 50%' 
					},
					'50%': { 
						backgroundPosition: '100% 50%' 
					}
				},
				'shine': {
					'0%, 100%': {
						backgroundPosition: '0% 50%'
					},
					'50%': {
						backgroundPosition: '100% 50%'
					}
				},
				'rotate': {
					'0%': {
						transform: 'rotate(0deg)'
					},
					'100%': {
						transform: 'rotate(360deg)'
					}
				},
				'glow': {
					'0%, 100%': {
						textShadow: '0 0 5px currentColor, 0 0 10px currentColor'
					},
					'50%': {
						textShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'pulse-glow': 'pulse-glow 3s infinite ease-in-out',
				'float': 'float 6s ease-in-out infinite',
				'scale-in': 'scale-in 0.3s ease-out forwards',
				'slide-up': 'slide-up 0.4s ease-out forwards',
				'gradient-shift': 'gradient-shift 8s ease infinite',
				'shine': 'shine 3s ease-in-out infinite',
				'rotate': 'rotate 2s linear infinite',
				'glow': 'glow 2s ease-in-out infinite alternate'
			},
			backgroundImage: {
				'memecoin-gradient': 'linear-gradient(135deg, #FF4136 0%, #ff6b5a 25%, #673AB7 50%, #14F195 75%, #FF4136 100%)',
				'glass-card': 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
				'shiny-button': 'linear-gradient(45deg, #ff4136, #ff6b5a, #ff4136)',
				'neon-border': 'linear-gradient(45deg, #ff4136, #14f195, #673ab7, #ff4136)'
			},
			backdropFilter: {
				'none': 'none',
				'blur': 'blur(20px)',
				'blur-xl': 'blur(40px)'
			},
			boxShadow: {
				'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)',
				'neon': '0 0 10px rgba(255, 65, 54, 0.5), 0 0 20px rgba(255, 65, 54, 0.3), 0 0 30px rgba(255, 65, 54, 0.1)',
				'glow': '0 0 20px rgba(255, 65, 54, 0.4), 0 4px 15px 0 rgba(255, 65, 54, 0.4)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
