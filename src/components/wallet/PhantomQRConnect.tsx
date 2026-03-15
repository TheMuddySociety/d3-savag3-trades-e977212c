import { useModal, usePhantom } from "@phantom/react-sdk";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

interface PhantomQRConnectProps {
  variant?: "default" | "compact";
}

export function PhantomQRConnect({ variant = "default" }: PhantomQRConnectProps) {
  const { open } = useModal();
  const { isConnected } = usePhantom();

  if (isConnected) return null;

  if (variant === "compact") {
    return (
      <Button
        onClick={() => open()}
        variant="outline"
        size="icon"
        className="h-7 w-7 border-border"
        title="Connect via Phantom QR"
      >
        <QrCode className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Button
      onClick={() => open()}
      variant="outline"
      className="gap-2 border-border hover:bg-secondary"
    >
      <QrCode className="h-4 w-4" />
      Connect via Phantom
    </Button>
  );
}
