import { useEffect, useState } from 'react'

interface PageLoaderProps {
  onLoadComplete: () => void
}

const PageLoader = ({ onLoadComplete }: PageLoaderProps) => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer)
          setTimeout(onLoadComplete, 300)
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 100)

    return () => clearInterval(timer)
  }, [onLoadComplete])

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #191919 0%, #2A2A2A 50%, #3A3A3A 100%)',
      }}
    >
      <div className="text-center">
        <div className="mb-8">
          <img 
            src="/logo.png" 
            alt="Crownie Logo" 
            className="w-24 h-24 mx-auto animate-pulse"
          />
        </div>
        
        <div className="w-64 h-1 bg-gray-700 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-crownie-primary to-crownie-secondary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-crownie-primary text-sm font-medium">
          Loading Crownie...
        </p>
      </div>
    </div>
  )
}

export default PageLoader