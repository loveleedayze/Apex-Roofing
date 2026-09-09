import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MaggieChat from "@/components/MaggieChat";

/**
 * Shell for the public marketing site. This is a route *group*, so it adds no
 * URL segment — `/`, `/services/*` etc. resolve exactly as before.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      {/* Persistent AI receptionist — anchored bottom-LEFT */}
      <MaggieChat />
    </>
  );
}
