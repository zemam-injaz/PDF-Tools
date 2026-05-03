import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';

export async function openPath(path: string) {
  try {
    if (path) {
      // Use custom Rust command to avoid plugin issues
      await invoke('open_in_explorer', { path });
    } else {
      console.warn('Attempted to open empty path');
    }
  } catch (error) {
    console.error('Failed to open path:', error);
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a default output path based on the input path.
 * Retains the same directory but appends a suffix to the filename.
 * Example: "C:\Docs\file.pdf" + "_merged" -> "C:\Docs\file_merged.pdf"
 */
export function getDefaultOutputPath(inputPath: string, suffix: string = '_output'): string {
  if (!inputPath) return '';
  
  // Handle both Windows and Unix separators
  const separator = inputPath.includes('\\') ? '\\' : '/';
  const lastSeparatorIndex = inputPath.lastIndexOf(separator);
  
  if (lastSeparatorIndex === -1) return inputPath; // Should not happen with absolute paths
  
  const directory = inputPath.substring(0, lastSeparatorIndex);
  const filename = inputPath.substring(lastSeparatorIndex + 1);
  const lastDotIndex = filename.lastIndexOf('.');
  
  let nameWithoutExt = filename;
  let ext = '.pdf';
  
  if (lastDotIndex !== -1) {
    nameWithoutExt = filename.substring(0, lastDotIndex);
    ext = filename.substring(lastDotIndex);
  }
  
  return `${directory}${separator}${nameWithoutExt}${suffix}${ext}`;
}
