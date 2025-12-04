"use client"

import React, { useCallback, useEffect, useRef } from "react"
import {
  EmblaCarouselType,
  EmblaEventType,
  EmblaOptionsType,
} from "embla-carousel"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"

import { NextButton, PrevButton, useCarouselButtons } from "./carousel-button"
import { CarouselIndicator, useCarouselIndicator } from "./carousel-indicator"

// Carousel props for reusability
interface EmblaCarouselProps {
  className?: string
  slides: React.ReactNode[]
  options?: EmblaOptionsType
  maxRotateX?: number
  maxRotateY?: number
  maxScale?: number
  tweenFactorBase?: number
  autoplay?: boolean
  autoplayDelay?: number
  showIndicators?: boolean
  showArrows?: boolean
}

const TWEEN_FACTOR_BASE = 0.52
const MAX_ROTATE_X = 0
const MAX_ROTATE_Y = 0
const MAX_SCALE = 0.9

const numberWithinRange = (number: number, min: number, max: number): number =>
  Math.min(Math.max(number, min), max)

// Generic EmblaCarousel component
export const EmblaCarousel: React.FC<EmblaCarouselProps> = ({
  slides,
  options,
  className,
  autoplay = false,
  autoplayDelay = 5000,
  maxRotateX = MAX_ROTATE_X,
  maxRotateY = MAX_ROTATE_Y,
  maxScale = MAX_SCALE,
  tweenFactorBase = TWEEN_FACTOR_BASE,
  showIndicators = true,
  showArrows = false,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    options,
    autoplay
      ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: false })]
      : []
  )

  const tweenFactor = useRef(0)
  const tweenNodes = useRef<HTMLElement[]>([])

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = useCarouselButtons(emblaApi)

  const { selectedIndex, scrollSnaps, onDotButtonClick } =
    useCarouselIndicator(emblaApi)

  // For 3D/scale effect (optional, can be extended)
  const setTweenNodes = useCallback((emblaApi: EmblaCarouselType): void => {
    tweenNodes.current = emblaApi.slideNodes().map((slideNode: HTMLElement) => {
      return slideNode.querySelector(".embla__slide__content") as HTMLElement
    })
  }, [])

  const setTweenFactor = useCallback(
    (emblaApi: EmblaCarouselType) => {
      tweenFactor.current = tweenFactorBase * emblaApi.scrollSnapList().length
    },
    [tweenFactorBase]
  )

  const tweenScale = useCallback(
    (emblaApi: EmblaCarouselType, eventName?: EmblaEventType) => {
      const engine = emblaApi.internalEngine()
      const scrollProgress = emblaApi.scrollProgress()
      const slidesInView = emblaApi.slidesInView()
      const isScrollEvent = eventName === "scroll"

      emblaApi
        .scrollSnapList()
        .forEach((scrollSnap: number, snapIndex: number) => {
          let diffToTarget = scrollSnap - scrollProgress
          const slidesInSnap = engine.slideRegistry[snapIndex]

          slidesInSnap.forEach((slideIndex: number) => {
            if (isScrollEvent && !slidesInView.includes(slideIndex)) return

            if (engine.options.loop) {
              engine.slideLooper.loopPoints.forEach((loopItem: { target: () => number; index: number }) => {
                const target = loopItem.target()
                if (slideIndex === loopItem.index && target !== 0) {
                  const sign = Math.sign(target)
                  if (sign === -1) {
                    diffToTarget = scrollSnap - (1 + scrollProgress)
                  }
                  if (sign === 1) {
                    diffToTarget = scrollSnap + (1 - scrollProgress)
                  }
                }
              })
            }

            const tweenValue = Math.abs(diffToTarget * tweenFactor.current)
            const scale = numberWithinRange(1 - tweenValue * 0.2, maxScale, 1)
            const rotateY = numberWithinRange(
              diffToTarget * maxRotateY,
              -maxRotateY,
              maxRotateY
            )
            const rotateX = numberWithinRange(
              diffToTarget * maxRotateX,
              -maxRotateX,
              maxRotateX
            )
            const tweenNode = tweenNodes.current[slideIndex]
            if (tweenNode) {
              tweenNode.style.transform = `scale(${scale}) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`
            }
          })
        })
    },
    [maxScale, maxRotateX, maxRotateY]
  )

  useEffect(() => {
    if (!emblaApi) return
    setTweenNodes(emblaApi)
    setTweenFactor(emblaApi)
    tweenScale(emblaApi)
    emblaApi
      .on("reInit", setTweenNodes)
      .on("reInit", setTweenFactor)
      .on("reInit", tweenScale)
      .on("scroll", tweenScale)
    return () => {
      emblaApi
        .off("reInit", setTweenNodes)
        .off("reInit", setTweenFactor)
        .off("reInit", tweenScale)
        .off("scroll", tweenScale)
    }
  }, [emblaApi, setTweenFactor, setTweenNodes, tweenScale])

  return (
    <div className={className || ""}>
      <div className="overflow-visible py-10" ref={emblaRef}>
        <div className="embla__container flex">
          {slides.map((slide, index) => (
            <div
              className="embla__slide [flex:0_0_20rem] pl-4 max-[350px]:[flex:0_0_18rem]"
              key={index}
            >
              <div className="embla__slide__content h-full min-h-[25rem] w-full">
                {slide}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showArrows && (
        <div className="flex items-center justify-center gap-4 py-10">
          <PrevButton
            className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 hover:ring-1 hover:ring-neutral-300 dark:bg-neutral-800 dark:hover:ring-neutral-700"
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
          />
          <NextButton
            className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 hover:ring-1 hover:ring-neutral-300 dark:bg-neutral-800 dark:hover:ring-neutral-700"
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
          />
        </div>
      )}
      {showIndicators && (
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center justify-center gap-3">
            {scrollSnaps.map((_, index) => (
              <CarouselIndicator
                key={index}
                onClick={() => onDotButtonClick(index)}
                className={
                  "relative m-0 inline-flex h-5 w-[1.5rem] cursor-pointer touch-manipulation items-center justify-center rounded-md border-0 bg-transparent p-0 no-underline [-webkit-appearance:none] [-webkit-tap-highlight-color:rgba(255,255,255,0)] after:flex after:h-0.5 after:w-full after:items-center after:justify-center after:bg-neutral-200 after:content-[''] dark:after:bg-neutral-800" +
                  (index === selectedIndex
                    ? " before:absolute before:top-1/2 before:left-0 before:h-0.5 before:w-full before:-translate-y-1/2 before:bg-neutral-800 before:transition-all before:duration-300 before:ease-out dark:before:bg-neutral-200"
                    : " before:absolute before:top-1/2 before:left-0 before:h-0.5 before:w-0 before:-translate-y-1/2 before:bg-neutral-200 before:transition-all before:duration-300 before:ease-out dark:before:bg-neutral-800")
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Testimonial data
const CarouselSlidesData = [
  {
    id: 1,
    text: "The Sky-Dweller is a compelling timepiece of contemporary design.",
    name: "John Doe",
    role: "CEO, Company Name",
    image:
      "https://plus.unsplash.com/premium_photo-1675432656807-216d786dd468?q=80&w=1980&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: 2,
    text: "The Sky-Dweller is a compelling timepiece of contemporary design.",
    name: "John Doe",
    role: "CEO, Company Name",
    image:
      "https://plus.unsplash.com/premium_photo-1669725687221-6fe12c2da6b1?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: 3,
    text: "The Sky-Dweller is a compelling timepiece of contemporary design.",
    name: "John Doe",
    role: "CEO, Company Name",
    image:
      "https://plus.unsplash.com/premium_photo-1669725687150-15c603ac6a73?w=200&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1pbi1zYW1lLXNlcmllc3w1fHx8ZW58MHx8fHx8",
  },
  {
    id: 4,
    text: "The Sky-Dweller is a compelling timepiece of contemporary design.",
    name: "John Doe",
    role: "CEO, Company Name",
    image:
      "https://plus.unsplash.com/premium_photo-1669740462444-ba6e0c316b59?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDZ8fHxlbnwwfHx8fHw%3D",
  },
  {
    id: 5,
    text: "The Sky-Dweller is a compelling timepiece of contemporary design.",
    name: "John Doe",
    role: "CEO, Company Name",
    image:
      "https://plus.unsplash.com/premium_photo-1669725687221-6fe12c2da6b1?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
]

// Main export: EmblaCarousel2 using the generic EmblaCarousel
export function EmblaCarousel2() {
  const OPTIONS: EmblaOptionsType = {
    loop: true,
    align: "center",
    containScroll: "trimSnaps",
  }
  const slides = CarouselSlidesData.map((testimonial) => (
    <div
      key={testimonial.id}
      className="relative flex h-full w-full cursor-grab rounded-xl border select-none"
    >
      <div className="z-[1] h-full w-full">
        <div className="text-content flex h-full w-full flex-col items-start justify-end gap-x-10 p-3.5 md:flex-row md:items-end md:justify-between">
          <img
            src={testimonial.image}
            alt={testimonial.name}
            className="absolute top-0 left-0 -z-10 h-full w-full rounded-xl object-cover"
          />
          <div className="flex h-fit w-full flex-col gap-y-2 rounded-xl border-2 p-5 backdrop-blur-sm" style={{ borderColor: '#1A1A1A', backgroundColor: 'rgba(255,252,242,0.1)' }}>
            <h2 className="text-left text-base leading-6 font-medium text-balance" style={{ color: '#fffcf2' }}>
              {testimonial.text}
            </h2>
            <div className="flex flex-col gap-y-0.5">
              <p className="text-left text-sm font-semibold text-balance" style={{ color: '#fffcf2' }}>
                {testimonial.name}
              </p>
              <p className="text-left text-xs font-medium text-balance" style={{ color: '#fffcf2', opacity: 0.8 }}>
                {testimonial.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ))

  return (
    <section className="flex w-full flex-col items-center justify-center">
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-center overflow-hidden p-5 pt-10 pb-28 md:py-20">
        <EmblaCarousel
          slides={slides}
          options={OPTIONS}
          autoplay={true}
          showIndicators={true}
          showArrows={false}
          className="w-full"
        />
        <div className="from-background pointer-events-none absolute inset-y-0 left-0 hidden h-full w-1/5 bg-gradient-to-r md:block" />
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/5 bg-gradient-to-l md:block" />
      </div>
    </section>
  )
}
