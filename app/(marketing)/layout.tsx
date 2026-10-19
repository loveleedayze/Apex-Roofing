import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MaggieChat from "@/components/MaggieChat";
import MaggieCall from "@/components/MaggieCall";

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
      {/* Maggie has two front doors on the site, in opposite corners so they
          never overlap: text chat on the left, a live voice call on the right.
          Both route into the same brain and the same CRM pipeline. */}
      <MaggieChat />
      <MaggieCall />
    </>
  );
}
