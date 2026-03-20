import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Rocket,
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  ImageIcon,
  Globe,
  Twitter,
  Send,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  JupiterStudioService,
  CURVE_PRESETS,
  type CurvePreset,
  type TokenCreateParams,
} from "@/services/jupiter/studio";
import { cn } from "@/lib/utils";

type Step = "configure" | "curve" | "upload" | "review";
const STEPS: Step[] = ["configure", "curve", "upload", "review"];
const STEP_LABELS: Record<Step, string> = {
  configure: "Token Info",
  curve: "Bonding Curve",
  upload: "Image",
  review: "Launch",
};

export function TokenLaunchWizard() {
  const { publicKey, wallet } = useWallet();
  const walletAdapter = wallet?.adapter as any;
  const [step, setStep] = useState<Step>("configure");
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ mint: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [preset, setPreset] = useState<CurvePreset>("meme");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const canGoNext =
    (step === "configure" && tokenName.trim() && tokenSymbol.trim()) ||
    step === "curve" ||
    (step === "upload" && imageFile) ||
    step === "review";

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLaunch = async () => {
    if (!publicKey || !walletAdapter) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!imageFile) {
      toast.error("Please upload a token image");
      return;
    }

    setIsLaunching(true);
    try {
      const params: TokenCreateParams = {
        tokenName,
        tokenSymbol,
        creator: publicKey.toBase58(),
        preset,
        tokenImageContentType: imageFile.type as any,
      };

      const result = await JupiterStudioService.launchToken(
        walletAdapter,
        params,
        imageFile,
        {
          name: tokenName,
          symbol: tokenSymbol,
          description,
          website: website || undefined,
          twitter: twitter || undefined,
          telegram: telegram || undefined,
        }
      );

      if (result) {
        setLaunchResult({ mint: result.mint });
      }
    } catch (e) {
      console.error("Launch error:", e);
    } finally {
      setIsLaunching(false);
    }
  };

  if (launchResult) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/40">
          <Check className="h-8 w-8 text-accent" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Token Launched! 🚀</h3>
        <p className="text-sm text-muted-foreground">
          Mint: <span className="font-mono text-foreground">{launchResult.mint.slice(0, 8)}...{launchResult.mint.slice(-6)}</span>
        </p>
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`https://solscan.io/token/${launchResult.mint}`, "_blank")}
          >
            View on Solscan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`https://jup.ag/studio/${launchResult.mint}`, "_blank")}
          >
            View on Jupiter
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setLaunchResult(null);
              setStep("configure");
              setTokenName("");
              setTokenSymbol("");
              setDescription("");
              setImageFile(null);
              setImagePreview(null);
            }}
          >
            Launch Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-between px-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all",
                i < stepIndex
                  ? "bg-accent text-accent-foreground"
                  : i === stepIndex
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn("text-[10px] hidden sm:block", i === stepIndex ? "text-foreground font-medium" : "text-muted-foreground")}>
              {STEP_LABELS[s]}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-px mx-1", i < stepIndex ? "bg-accent" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[240px]">
        {/* STEP 1: Configure */}
        {step === "configure" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Token Name *</Label>
                <Input
                  placeholder="e.g. Degen Ape"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Symbol *</Label>
                <Input
                  placeholder="e.g. DAPE"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  className="h-8 text-xs font-mono"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Tell the world about your token..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px] text-xs resize-none"
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] flex items-center gap-1 text-muted-foreground">
                  <Globe className="h-2.5 w-2.5" /> Website
                </Label>
                <Input
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-7 text-[10px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] flex items-center gap-1 text-muted-foreground">
                  <Twitter className="h-2.5 w-2.5" /> Twitter
                </Label>
                <Input
                  placeholder="@handle"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="h-7 text-[10px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] flex items-center gap-1 text-muted-foreground">
                  <Send className="h-2.5 w-2.5" /> Telegram
                </Label>
                <Input
                  placeholder="t.me/..."
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  className="h-7 text-[10px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Bonding Curve */}
        {step === "curve" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose a bonding curve preset that matches your token's purpose.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.entries(CURVE_PRESETS) as [CurvePreset, typeof CURVE_PRESETS.meme][]).map(
                ([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setPreset(key)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      preset === key
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-muted/20 hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {key === "meme" ? (
                        <Zap className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-accent" />
                      )}
                      <span className="text-sm font-semibold capitalize">{cfg.label}</span>
                      {preset === key && (
                        <Badge className="text-[9px] ml-auto bg-primary/20 text-primary border-primary/30">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {cfg.description}
                    </p>
                    <div className="mt-2 flex gap-3 text-[10px] font-mono text-muted-foreground">
                      <span>Start: ${cfg.initialMarketCap.toLocaleString()}</span>
                      <span>Grad: ${cfg.migrationMarketCap.toLocaleString()}</span>
                    </div>
                  </button>
                )
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary shrink-0" />
                Anti-sniping: {CURVE_PRESETS[preset].antiSniping ? "✅ ON" : "❌ OFF"} · 
                LP Locked: ✅ · Fee: {CURVE_PRESETS[preset].feeBps / 100}%
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Image Upload */}
        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Upload your token's logo image (JPEG/PNG, max 5MB).</p>
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary/50",
                imageFile ? "border-accent/50 bg-accent/5" : "border-border"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Token preview"
                    className="w-20 h-20 rounded-xl mx-auto object-cover ring-2 ring-accent/30"
                  />
                  <p className="text-xs text-accent font-medium">{imageFile?.name}</p>
                  <p className="text-[10px] text-muted-foreground">Click to change</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">Click or drag to upload</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Review & Launch */}
        {step === "review" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
              <div className="flex items-center gap-3">
                {imagePreview && (
                  <img src={imagePreview} alt="" className="w-12 h-12 rounded-lg object-cover" />
                )}
                <div>
                  <h4 className="text-sm font-bold">{tokenName}</h4>
                  <p className="text-xs font-mono text-muted-foreground">${tokenSymbol}</p>
                </div>
              </div>
              {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div><span className="text-muted-foreground">Curve:</span> <span className="font-medium capitalize">{preset}</span></div>
                <div><span className="text-muted-foreground">Start MC:</span> <span className="font-mono">${CURVE_PRESETS[preset].initialMarketCap.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Grad MC:</span> <span className="font-mono">${CURVE_PRESETS[preset].migrationMarketCap.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Fee:</span> <span className="font-mono">{CURVE_PRESETS[preset].feeBps / 100}%</span></div>
              </div>
            </div>

            {!publicKey ? (
              <p className="text-xs text-destructive text-center">Connect your wallet to launch</p>
            ) : (
              <Button
                className="w-full h-10 text-sm font-bold gap-2"
                onClick={handleLaunch}
                disabled={isLaunching}
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Launch Token on Jupiter Studio
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setStep(STEPS[stepIndex - 1])}
          disabled={stepIndex === 0}
        >
          <ChevronLeft className="h-3 w-3" /> Back
        </Button>
        {stepIndex < STEPS.length - 1 && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setStep(STEPS[stepIndex + 1])}
            disabled={!canGoNext}
          >
            Next <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
