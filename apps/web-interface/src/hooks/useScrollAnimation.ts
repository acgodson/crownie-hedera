import { useInView } from 'framer-motion'
import { useRef } from 'react'

export interface UseScrollAnimationOptions {
  threshold?: number
  triggerOnce?: boolean
  margin?: string
}

export const useScrollAnimation = (options: UseScrollAnimationOptions = {}) => {
  const { threshold = 0.1, triggerOnce = true, margin = "0px 0px -100px 0px" } = options
  const ref = useRef(null)
  
  const isInView = useInView(ref, {
    threshold,
    once: triggerOnce,
    margin,
  })

  return { ref, isInView }
}