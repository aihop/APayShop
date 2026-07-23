export interface ImageGalleryItem {
  id: string
  url: string
  thumbUrl?: string
  title?: string
  caption?: string
  downloadName?: string
}

export interface ImageGalleryLabels {
  previewImage: string
  actualSize: string
  fitScreen: string
  downloadImage: string
  downloadFallback: string
  zoomIn?: string
  zoomOut?: string
  rotateLeft?: string
  rotateRight?: string
  close?: string
  previous?: string
  next?: string
}
