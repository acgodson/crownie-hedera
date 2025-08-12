import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import Footer from "./components/organisms/footer"
import HeroSection from "./components/organisms/heroSection"
import SolutionSection from "./components/organisms/solutionSection"
import SwapWidget from "./components/SwapWidget"
import CompleteSwapWidget from "./components/CompleteSwapWidget"
import FillOrderWidget from "./components/FillOrderWidget"
import PageLoader from "./components/PageLoader"
import { WagmiProvider } from "./providers/WagmiProvider"

function App() {
  const [searchParams] = useSearchParams()
  const [showSwapWidget, setShowSwapWidget] = useState(false)
  const [showCompleteSwapWidget, setShowCompleteSwapWidget] = useState(false)
  const [showFillOrderWidget, setShowFillOrderWidget] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const secretHash = searchParams.get('secretHash')
    const meetingId = searchParams.get('meetingId')
    const orderId = searchParams.get('orderId')
    const secret = searchParams.get('secret')
    
    const currentPath = window.location.pathname
    
    if (currentPath.includes('/fill-order') && orderId && meetingId) {
      setShowFillOrderWidget(true)
      setShowSwapWidget(false)
      setShowCompleteSwapWidget(false)
    } else if (currentPath.includes('/complete-order') || (orderId && meetingId && secret)) {
      setShowCompleteSwapWidget(true)
      setShowSwapWidget(false)
      setShowFillOrderWidget(false)
    } else if (currentPath.includes('/create-order') || (secretHash && meetingId)) {
      setShowSwapWidget(true)
      setShowCompleteSwapWidget(false)
      setShowFillOrderWidget(false)
    } else {
      setShowSwapWidget(false)
      setShowCompleteSwapWidget(false)
      setShowFillOrderWidget(false)
    }
  }, [searchParams])

  if (showFillOrderWidget) {
    return (
      <WagmiProvider>
        <div className="min-h-screen bg-crownie-dark">
          <FillOrderWidget />
        </div>
      </WagmiProvider>
    )
  }

  if (showCompleteSwapWidget) {
    return (
      <WagmiProvider>
        <div className="min-h-screen bg-crownie-dark">
          <CompleteSwapWidget />
        </div>
      </WagmiProvider>
    )
  }

  if (showSwapWidget) {
    return (
      <WagmiProvider>
        <div className="min-h-screen bg-crownie-dark">
          <SwapWidget />
        </div>
      </WagmiProvider>
    )
  }

  if (isLoading) {
    return <PageLoader onLoadComplete={() => setIsLoading(false)} />
  }

  return (
    <div className="min-h-screen bg-crownie-dark">
      <HeroSection />
      <SolutionSection />
      <Footer />
    </div>
  )
}

export default App
