import { ConnectionStatus } from "@/components/connection-status";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConnectionStatus />
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
    </>
  );
}
