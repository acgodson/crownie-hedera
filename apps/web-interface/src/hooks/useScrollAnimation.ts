import { useInView } from 'framer-motion'
import { useRef } from 'react'

export interface UseScrollAnimationOptions {
  threshold?: number
  triggerOnce?: boolean
  margin?: string
}

export const useScrollAnimation = (options: UseScrollAnimationOptions = {}) => {
  const { triggerOnce = true, margin = "0px 0px -100px 0px" } = options
  const ref = useRef(null)
  
  const isInView = useInView(ref, {
    once: triggerOnce,
    margin: margin as any,
  } as any)

  return { ref, isInView }
}