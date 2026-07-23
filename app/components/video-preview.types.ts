export interface VideoPreviewItem {
  id: string
  url: string
  title?: string
  caption?: string
  downloadName?: string
}

export interface VideoPreviewLabels {
  previewVideo: string
  downloadVideo: string
  downloadFallback: string
}
