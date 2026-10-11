/**
 * Book Library API Client
 * Handles all book library operations with the Python backend
 */

import { localApiFetch } from '../lib/api';

export interface Book {
  id: number;
  file_path: string;
  title: string;
  total_pages: number;
  pages_read: number;
  reading_percentage: number;
  thumbnail_base64?: string;
  is_starred: boolean;
  priority: 'High' | 'Medium' | 'Low';
  category: string;
  notes: string;
  file_size: number;
  date_added: string;
  last_opened?: string;
  status: 'To Read' | 'Reading' | 'Read';
}

export interface AddBooksResult {
  added: Book[];
  skipped: string[];
  errors: Array<{ path: string; error: string }>;
  added_count: number;
  skipped_count: number;
  error_count: number;
}

export interface BookUpdate {
  title?: string;
  pages_read?: number;
  is_starred?: boolean;
  priority?: 'High' | 'Medium' | 'Low';
  category?: string;
  notes?: string;
  status?: 'To Read' | 'Reading' | 'Read';
}

export interface Annotation {
  page: number;
  type: string;
  author: string;
  content: string;
  subject: string;
  created_date: string;
  modified_date: string;
  color: [number, number, number] | null;
}

export interface BookmarkItem {
  level: number;
  title: string;
  page: number;
  end_page: number;
  page_count: number;
}

export interface BookmarkExtractionResult {
  bookmarks: BookmarkItem[];
  formatted_text: string;
  count: number;
  total_pages: number;
  has_bookmarks: boolean;
}

export const bookLibraryApi = {
  /**
   * Extract annotations from a PDF
   */
  async extractAnnotations(filePath: string): Promise<Annotation[]> {
    const response = await localApiFetch('/api/annotations/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: filePath }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to extract annotations');
    }

    return data.data;
  },

  /**
   * Extract bookmarks (TOC) with chapter weights
   */
  async extractBookmarks(filePath: string): Promise<BookmarkExtractionResult> {
    const response = await localApiFetch('/api/bookmarks/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: filePath }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to extract bookmarks');
    }

    return data.data;
  },

  /**
   * Get all books from the library
   */
  async getAllBooks(options?: {
    sortBy?: 'date_added' | 'title' | 'reading_percentage' | 'priority' | 'last_opened';
    order?: 'asc' | 'desc';
    category?: string;
    starredOnly?: boolean;
  }): Promise<{ books: Book[]; total_count: number }> {
    const params = new URLSearchParams();
    if (options?.sortBy) params.append('sort_by', options.sortBy);
    if (options?.order) params.append('order', options.order);
    if (options?.category) params.append('category', options.category);
    if (options?.starredOnly) params.append('starred_only', 'true');

    const response = await localApiFetch(`/api/books?${params.toString()}`);
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to fetch books');
    }
    
    return data.data;
  },

  /**
   * Add a single book to the library
   */
  async addBook(filePath: string): Promise<Book> {
    const response = await localApiFetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to add book');
    }
    
    return data.data;
  },

  /**
   * Add multiple books to the library
   */
  async addBooks(filePaths: string[]): Promise<AddBooksResult> {
    const response = await localApiFetch('/api/books/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_paths: filePaths }),
    });
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to add books');
    }
    
    return data.data;
  },

  /**
   * Get a single book by ID
   */
  async getBook(bookId: number): Promise<Book> {
    const response = await localApiFetch(`/api/books/${bookId}`);
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to fetch book');
    }
    
    return data.data;
  },

  /**
   * Update book metadata
   */
  async updateBook(bookId: number, updates: BookUpdate): Promise<Book> {
    const response = await localApiFetch(`/api/books/${bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to update book');
    }
    
    return data.data;
  },

  /**
   * Toggle the starred status of a book
   */
  async toggleStar(bookId: number): Promise<{ is_starred: boolean }> {
    const response = await localApiFetch(`/api/books/${bookId}/toggle-star`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to toggle star');
    }
    
    return data.data;
  },

  /**
   * Mark a book as opened (updates last_opened timestamp)
   */
  async markOpened(bookId: number): Promise<void> {
    const response = await localApiFetch(`/api/books/${bookId}/opened`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to update last opened');
    }
  },

  /**
   * Delete a book from the library
   */
  async deleteBook(bookId: number): Promise<void> {
    const response = await localApiFetch(`/api/books/${bookId}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to delete book');
    }
  },

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const response = await localApiFetch('/api/books/categories/list');
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to fetch categories');
    }
    
    return data.data.categories;
  },

  /**
   * Search books by title
   */
  async searchBooks(query: string): Promise<Book[]> {
    const response = await localApiFetch(`/api/books/search/${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to search books');
    }
    
    return data.data.books;
  },

  /**
   * System fallback to open file using backend
   */
  async systemOpenFile(filePath: string): Promise<void> {
    const response = await localApiFetch('/api/system/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to open file via system');
    }
  },

  /**
   * System fallback to reveal file in explorer
   */
  async systemRevealFile(filePath: string): Promise<void> {
    const response = await localApiFetch('/api/system/reveal-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to reveal file via system');
    }
  }
};
