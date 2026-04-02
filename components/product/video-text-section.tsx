'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'

interface VideoTextSectionProps {
  cmsContent?: {
    videoUrl?: string
    thumbnail?: string
    title?: string
    content?: string[]
  }
  cmsConfig?: {
    layout?: 'video_left' | 'video_right'
    backgroundColor?: string
    videoHeight?: number
  }
}

export function VideoTextSection({ cmsContent, cmsConfig }: VideoTextSectionProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoUrl = cmsContent?.videoUrl || ""
  const thumbnail = cmsContent?.thumbnail || ""
  const title = cmsContent?.title || ""
  const content = cmsContent?.content || []
  const layout = cmsConfig?.layout || 'video_left'
  const backgroundColor = cmsConfig?.backgroundColor || "#e5e7eb" // Default to gray-200
  const videoHeight = cmsConfig?.videoHeight
  const isVideoRight = layout === 'video_right'

  // If no content, don't render
  if (!videoUrl && !title && content.length === 0) {
    return null
  }

  // Convert YouTube/Vimeo URLs to embed format
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url
    }
    if (url.includes('vimeo.com/')) {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url
    }
    return url
  }

  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : ""

  return (
    <section className="py-8">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor }}>
          <div className="grid md:grid-cols-2 gap-0">
            {isVideoRight ? (
              <>
                {/* Content first */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  {title && (
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
                  )}
                  {content.map((paragraph, index) => (
                    <p key={index} className="text-gray-700 leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {/* Video */}
                {videoUrl && (
                  <div 
                    className="relative w-full self-stretch"
                    style={videoHeight ? { height: `${videoHeight}px`, minHeight: `${videoHeight}px`, maxHeight: `${videoHeight}px` } : { height: '100%', minHeight: '256px' }}
                  >
                    {isPlaying ? (
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={title || "Video"}
                      />
                    ) : (
                      <div 
                        className="relative w-full h-full cursor-pointer group" 
                        onClick={() => setIsPlaying(true)}
                      >
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={title || "Video thumbnail"}
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
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Video */}
                {videoUrl && (
                  <div 
                    className="relative w-full"
                    style={videoHeight ? { height: `${videoHeight}px`, minHeight: `${videoHeight}px` } : { height: '256px', minHeight: '256px' }}
                  >
                    {isPlaying ? (
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={title || "Video"}
                      />
                    ) : (
                      <div 
                        className="relative w-full h-full cursor-pointer group" 
                        onClick={() => setIsPlaying(true)}
                      >
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={title || "Video thumbnail"}
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
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  {title && (
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
                  )}
                  {content.map((paragraph, index) => (
                    <p key={index} className="text-gray-700 leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

