import Footer from "./components/organisms/footer"
import HeroSection from "./components/organisms/heroSection"
// import ProblemSection from "./components/organisms/problemSection"
import SolutionSection from "./components/organisms/solutionSection"




function App() {
  return (
    <div className="min-h-screen bg-crownie-dark">
      <HeroSection />
      {/* <ProblemSection /> */}
      <SolutionSection />
      <Footer />
    </div>
  )
}

export default App
