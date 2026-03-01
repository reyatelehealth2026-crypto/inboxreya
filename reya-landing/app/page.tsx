import HeroSection from './sections/HeroSection'
import StatsSection from './sections/StatsSection'
import ProductsSection from './sections/ProductsSection'
import WhySection from './sections/WhySection'
import TestimonialsSection from './sections/TestimonialsSection'
import OemSection from './sections/OemSection'
import Footer from './sections/Footer'

export default function Home() {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <ProductsSection />
      <WhySection />
      <TestimonialsSection />
      <OemSection />
      <Footer />
    </main>
  )
}
