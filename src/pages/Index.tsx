import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDashboard } from "./layouts/MobileDashboard";
import { DesktopDashboard } from "./layouts/DesktopDashboard";

const Index = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
};

export default Index;
