import { describe, it, expect } from 'vitest'
import { detectFromExtension, detectFromBytes } from '../../src/core/detect'
import { docTypeFromMime } from '../../src/core/mime'

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

describe('new built-in formats — extensions', () => {
  it('maps media, html, json and code extensions', () => {
    expect(detectFromExtension('clip.mp4')).toBe('video')
    expect(detectFromExtension('clip.webm')).toBe('video')
    expect(detectFromExtension('song.mp3')).toBe('audio')
    expect(detectFromExtension('song.wav')).toBe('audio')
    expect(detectFromExtension('page.html')).toBe('html')
    expect(detectFromExtension('page.htm')).toBe('html')
    expect(detectFromExtension('data.json')).toBe('json')
    for (const ext of ['js', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'css', 'xml', 'yaml', 'yml', 'sh', 'sql', 'toml']) {
      expect(detectFromExtension(`file.${ext}`), ext).toBe('code')
    }
    expect(detectFromExtension('notes.txt')).toBe('text')
  })
})

describe('new built-in formats — magic bytes', () => {
  it('detects mp4/webm/ogg/mp3/wav containers', () => {
    expect(detectFromBytes(Uint8Array.from([0, 0, 0, 0x18, ...ascii('ftypisom')]))).toBe('video')
    expect(detectFromBytes(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBe('video')
    expect(detectFromBytes(Uint8Array.from([...ascii('ID3'), 3, 0]))).toBe('audio')
    expect(detectFromBytes(Uint8Array.from([0xff, 0xfb, 0x90, 0x00]))).toBe('audio')
    expect(detectFromBytes(Uint8Array.from([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')]))).toBe('audio')
    expect(detectFromBytes(Uint8Array.from([...ascii('OggS'), 0, 2]))).toBe('audio')
  })

  it('detects html and json text', () => {
    expect(detectFromBytes(new TextEncoder().encode('<!DOCTYPE html><html><body>x</body></html>'))).toBe('html')
    expect(detectFromBytes(new TextEncoder().encode('  {"a": [1, 2]}'))).toBe('json')
    expect(detectFromBytes(new TextEncoder().encode('plain words'))).toBe('text')
  })
})

describe('new built-in formats — mime', () => {
  it('maps media/html/json/xml types', () => {
    expect(docTypeFromMime('video/mp4')).toBe('video')
    expect(docTypeFromMime('audio/mpeg')).toBe('audio')
    expect(docTypeFromMime('text/html')).toBe('html')
    expect(docTypeFromMime('application/json')).toBe('json')
    expect(docTypeFromMime('application/xml')).toBe('code')
    expect(docTypeFromMime('text/javascript')).toBe('code')
  })
})
