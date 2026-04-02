'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'

interface ProductVideoSectionProps {
  cmsContent?: {
    videoUrl?: string
    thumbnail?: string
    autoplay?: boolean
  }
}

export function ProductVideoSection({ cmsContent }: ProductVideoSectionProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoUrl = cmsContent?.videoUrl
  const thumbnail = cmsContent?.thumbnail
  const autoplay = cmsContent?.autoplay || false

  if (!videoUrl) {
    return null
  }

  // Convert YouTube/Vimeo URLs to embed format
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      return videoId ? `https://www.youtube.com/embed/${videoId}${autoplay ? '?autoplay=1' : ''}` : url
    }
    if (url.includes('vimeo.com/')) {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}${autoplay ? '?autoplay=1' : ''}` : url
    }
    return url
  }

  const embedUrl = getEmbedUrl(videoUrl)

  if (isPlaying || autoplay) {
    return (
      <section className="w-full py-8">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="relative aspect-video w-full max-w-5xl mx-auto rounded-lg overflow-hidden">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Product Video"
            />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full py-16">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="relative aspect-video w-full max-w-5xl mx-auto rounded-lg overflow-hidden group cursor-pointer" onClick={() => setIsPlaying(true)}>
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt="Video thumbnail"
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <Play className="w-20 h-20 text-white" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-10 h-10 text-gray-900 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

