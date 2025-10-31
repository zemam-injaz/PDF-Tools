#!/usr/bin/env python3
"""
Reading Position Database Manager
Manages persistent storage of reading positions for the Reading Speed Tab

This module provides database operations for saving and retrieving reading positions,
allowing users to resume training sessions from where they left off.

Database Schema:
- document_path: Full path to the document (PRIMARY KEY)
- document_type: File type ('pdf', 'txt', 'docx')
- last_page: Last page number for PDFs (NULL for TXT/DOCX)
- last_word_index: Position in the word list
- last_character_position: Character position in document (optional)
- training_mode: Training mode used ('standard', 'rsvp', 'scrolling', 'chunking', 'elimination')
- wpm_setting: Words per minute setting
- words_per_glance: WPG setting
- last_accessed: Last training session timestamp
- total_words_read: Cumulative word count
- document_hash: Hash to detect file changes (optional)

Author: Reading Speed Tab Development Team
Date: 2025-10-25
"""

import sqlite3
import os
import hashlib
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from pathlib import Path


class ReadingPositionDB:
    """Database manager for reading positions"""

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the database manager.

        Args:
            db_path: Path to the SQLite database file. If None, uses default location.
        """
        if db_path is None:
            # Default location: data/reading_positions.db in the application directory
            app_dir = Path(__file__).parent.parent
            data_dir = app_dir / "data"
            data_dir.mkdir(exist_ok=True)
            db_path = str(data_dir / "reading_positions.db")

        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """Initialize the database and create tables if they don't exist"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create reading_positions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reading_positions (
                    document_path TEXT PRIMARY KEY,
                    document_type TEXT NOT NULL,
                    last_page INTEGER,
                    last_word_index INTEGER NOT NULL,
                    last_character_position INTEGER,
                    training_mode TEXT NOT NULL,
                    wpm_setting INTEGER NOT NULL,
                    words_per_glance INTEGER NOT NULL,
                    last_accessed TIMESTAMP NOT NULL,
                    total_words_read INTEGER DEFAULT 0,
                    document_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create index on last_accessed for faster queries
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_last_accessed
                ON reading_positions(last_accessed DESC)
            """)

            # Create page_word_counts table for per-page word counts (for Pages/Minute)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS page_word_counts (
                    document_path TEXT NOT NULL,
                    page_number INTEGER NOT NULL,
                    word_count INTEGER NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (document_path, page_number)
                )
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pwc_document
                ON page_word_counts(document_path)
            """)

            conn.commit()
            conn.close()

        except sqlite3.Error as e:
            print(f"Error initializing database: {e}")
            raise

    def _calculate_file_hash(self, file_path: str) -> Optional[str]:
        """
        Calculate SHA256 hash of a file to detect changes.

        Args:
            file_path: Path to the file

        Returns:
            SHA256 hash string or None if file doesn't exist
        """
        try:
            if not os.path.exists(file_path):
                return None

            # For large files, only hash first 1MB to improve performance
            hash_obj = hashlib.sha256()
            with open(file_path, 'rb') as f:
                # Read first 1MB
                chunk = f.read(1024 * 1024)
                hash_obj.update(chunk)

            return hash_obj.hexdigest()
        except Exception as e:
            print(f"Error calculating file hash: {e}")
            return None

    def save_reading_position(self, document_path: str, position_data: Dict) -> bool:
        """
        Save or update reading position for a document.

        Args:
            document_path: Full path to the document
            position_data: Dictionary containing:
                - document_type: 'pdf', 'txt', or 'docx'
                - last_page: Page number (for PDFs, optional)
                - last_word_index: Current word index
                - last_character_position: Character position (optional)
                - training_mode: Training mode name
                - wpm_setting: WPM value
                - words_per_glance: WPG value
                - total_words_read: Total words read (optional)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Calculate file hash
            file_hash = self._calculate_file_hash(document_path)

            # Prepare data
            data = {
                'document_path': document_path,
                'document_type': position_data.get('document_type', 'unknown'),
                'last_page': position_data.get('last_page'),
                'last_word_index': position_data.get('last_word_index', 0),
                'last_character_position': position_data.get('last_character_position'),
                'training_mode': position_data.get('training_mode', 'standard'),
                'wpm_setting': position_data.get('wpm_setting', 300),
                'words_per_glance': position_data.get('words_per_glance', 3),
                'last_accessed': datetime.now().isoformat(),
                'total_words_read': position_data.get('total_words_read', 0),
                'document_hash': file_hash
            }

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Use INSERT OR REPLACE to update if exists
            cursor.execute("""
                INSERT OR REPLACE INTO reading_positions
                (document_path, document_type, last_page, last_word_index,
                 last_character_position, training_mode, wpm_setting,
                 words_per_glance, last_accessed, total_words_read, document_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data['document_path'],
                data['document_type'],
                data['last_page'],
                data['last_word_index'],
                data['last_character_position'],
                data['training_mode'],
                data['wpm_setting'],
                data['words_per_glance'],
                data['last_accessed'],
                data['total_words_read'],
                data['document_hash']
            ))

            conn.commit()
            conn.close()

            return True

        except sqlite3.Error as e:
            print(f"Database error saving reading position: {e}")
            return False
        except Exception as e:
            print(f"Error saving reading position: {e}")
            return False

    def load_reading_position(self, document_path: str) -> Optional[Dict]:
        """
        Load saved reading position for a document.

        Args:
            document_path: Full path to the document

        Returns:
            Dictionary with position data or None if not found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            cursor = conn.cursor()

            cursor.execute("""
                SELECT * FROM reading_positions
                WHERE document_path = ?
            """, (document_path,))

            row = cursor.fetchone()
            conn.close()

            if row is None:
                return None

            # Convert row to dictionary
            position_data = {
                'document_path': row['document_path'],
                'document_type': row['document_type'],
                'last_page': row['last_page'],
                'last_word_index': row['last_word_index'],
                'last_character_position': row['last_character_position'],
                'training_mode': row['training_mode'],
                'wpm_setting': row['wpm_setting'],
                'words_per_glance': row['words_per_glance'],
                'last_accessed': row['last_accessed'],
                'total_words_read': row['total_words_read'],
                'document_hash': row['document_hash']
            }

            # Verify file still exists and hasn't changed
            if not os.path.exists(document_path):
                position_data['file_status'] = 'missing'
            else:
                current_hash = self._calculate_file_hash(document_path)
                if current_hash != position_data['document_hash']:
                    position_data['file_status'] = 'modified'
                else:
                    position_data['file_status'] = 'valid'

            return position_data

        except sqlite3.Error as e:
            print(f"Database error loading reading position: {e}")
            return None
        except Exception as e:
            print(f"Error loading reading position: {e}")
            return None

    def update_reading_position(self, document_path: str, word_index: int,
                               total_words_read: Optional[int] = None) -> bool:
        """
        Quick update of word index during training (for auto-save).

        Args:
            document_path: Full path to the document
            word_index: Current word index
            total_words_read: Total words read (optional)

        Returns:
            True if successful, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            if total_words_read is not None:
                cursor.execute(
                    """
                    UPDATE reading_positions
                    SET last_word_index = ?,
                        total_words_read = ?,
                        last_accessed = ?
                    WHERE document_path = ?
                    """,
                    (word_index, total_words_read, datetime.now().isoformat(), document_path)
                )
            else:
                cursor.execute(
                    """
                    UPDATE reading_positions
                    SET last_word_index = ?,
                        last_accessed = ?
                    WHERE document_path = ?
                    """,
                    (word_index, datetime.now().isoformat(), document_path)
                )

            conn.commit()
            conn.close()
            return True

        except sqlite3.Error as e:
            print(f"Database error updating reading position: {e}")
            return False
        except Exception as e:
            print(f"Error updating reading position: {e}")
            return False

    def save_page_word_counts(self, document_path: str, counts: Dict[int, int]) -> bool:
        """Save per-page word counts for a document (used by Pages/Minute tab)."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            rows = [(document_path, int(p), int(w)) for p, w in counts.items()]
            cursor.executemany(
                """
                INSERT OR REPLACE INTO page_word_counts (document_path, page_number, word_count, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                rows
            )
            conn.commit()
            conn.close()
            return True
        except sqlite3.Error as e:
            print(f"Database error saving page word counts: {e}")
            return False
        except Exception as e:
            print(f"Error saving page word counts: {e}")
            return False

    def load_page_word_counts(self, document_path: str) -> Optional[Dict[int, int]]:
        """Load per-page word counts for a document. Returns dict {page_number: word_count}."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT page_number, word_count FROM page_word_counts
                WHERE document_path = ?
                ORDER BY page_number ASC
                """,
                (document_path,)
            )
            rows = cursor.fetchall()
            conn.close()
            if not rows:
                return None
            return {int(p): int(w) for (p, w) in rows}
        except sqlite3.Error as e:
            print(f"Database error loading page word counts: {e}")
            return None
        except Exception as e:
            print(f"Error loading page word counts: {e}")
            return None

    def has_page_word_counts(self, document_path: str) -> bool:
        """Check whether per-page word counts exist for the document."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM page_word_counts WHERE document_path = ? LIMIT 1", (document_path,))
            result = cursor.fetchone()
            conn.close()
            return result is not None
        except sqlite3.Error as e:
            print(f"Database error checking page word counts: {e}")
            return False
        except Exception as e:
            print(f"Error checking page word counts: {e}")
            return False

    def get_saved_documents(self, limit: int = 50) -> List[Dict]:
        """
        Get list of all documents with saved positions.

        Args:
            limit: Maximum number of documents to return (default 50)

        Returns:
            List of dictionaries with document information, sorted by last_accessed
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT * FROM reading_positions
                ORDER BY last_accessed DESC
                LIMIT ?
            """, (limit,))

            rows = cursor.fetchall()
            conn.close()

            documents = []
            for row in rows:
                doc_data = {
                    'document_path': row['document_path'],
                    'document_type': row['document_type'],
                    'last_page': row['last_page'],
                    'last_word_index': row['last_word_index'],
                    'training_mode': row['training_mode'],
                    'wpm_setting': row['wpm_setting'],
                    'words_per_glance': row['words_per_glance'],
                    'last_accessed': row['last_accessed'],
                    'total_words_read': row['total_words_read']
                }

                # Check if file still exists
                if os.path.exists(row['document_path']):
                    doc_data['file_status'] = 'exists'
                    doc_data['file_name'] = os.path.basename(row['document_path'])
                else:
                    doc_data['file_status'] = 'missing'
                    doc_data['file_name'] = os.path.basename(row['document_path']) + " (missing)"

                documents.append(doc_data)

            return documents

        except sqlite3.Error as e:
            print(f"Database error getting saved documents: {e}")
            return []
        except Exception as e:
            print(f"Error getting saved documents: {e}")
            return []

    def delete_reading_position(self, document_path: str) -> bool:
        """
        Delete saved reading position for a document.

        Args:
            document_path: Full path to the document

        Returns:
            True if successful, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                DELETE FROM reading_positions
                WHERE document_path = ?
            """, (document_path,))

            conn.commit()
            rows_deleted = cursor.rowcount
            conn.close()

            return rows_deleted > 0

        except sqlite3.Error as e:
            print(f"Database error deleting reading position: {e}")
            return False
        except Exception as e:
            print(f"Error deleting reading position: {e}")
            return False

    def cleanup_missing_files(self) -> int:
        """
        Remove database entries for files that no longer exist.

        Returns:
            Number of entries removed
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Get all document paths
            cursor.execute("SELECT document_path FROM reading_positions")
            rows = cursor.fetchall()

            deleted_count = 0
            for row in rows:
                if not os.path.exists(row['document_path']):
                    cursor.execute("""
                        DELETE FROM reading_positions
                        WHERE document_path = ?
                    """, (row['document_path'],))
                    deleted_count += 1

            conn.commit()
            conn.close()

            return deleted_count

        except sqlite3.Error as e:
            print(f"Database error cleaning up missing files: {e}")
            return 0
        except Exception as e:
            print(f"Error cleaning up missing files: {e}")
            return 0

    def get_statistics(self) -> Dict:
        """
        Get database statistics.

        Returns:
            Dictionary with statistics
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Total documents
            cursor.execute("SELECT COUNT(*) FROM reading_positions")
            total_docs = cursor.fetchone()[0]

            # Total words read across all documents
            cursor.execute("SELECT SUM(total_words_read) FROM reading_positions")
            total_words = cursor.fetchone()[0] or 0

            # Most recent session
            cursor.execute("""
                SELECT last_accessed FROM reading_positions
                ORDER BY last_accessed DESC LIMIT 1
            """)
            result = cursor.fetchone()
            most_recent = result[0] if result else None

            conn.close()

            return {
                'total_documents': total_docs,
                'total_words_read': total_words,
                'most_recent_session': most_recent
            }

        except sqlite3.Error as e:
            print(f"Database error getting statistics: {e}")
            return {
                'total_documents': 0,
                'total_words_read': 0,
                'most_recent_session': None
            }
        except Exception as e:
            print(f"Error getting statistics: {e}")
            return {
                'total_documents': 0,
                'total_words_read': 0,
                'most_recent_session': None
            }


# Convenience function for testing
def test_database():
    """Test the database functionality"""
    print("Testing ReadingPositionDB...")

    # Create database instance
    db = ReadingPositionDB()
    print(f"✅ Database initialized at: {db.db_path}")

    # Test save
    test_data = {
        'document_type': 'pdf',
        'last_page': 45,
        'last_word_index': 1234,
        'training_mode': 'standard',
        'wpm_setting': 300,
        'words_per_glance': 3,
        'total_words_read': 5000
    }

    success = db.save_reading_position('/test/document.pdf', test_data)
    print(f"✅ Save test: {'Success' if success else 'Failed'}")

    # Test load
    loaded = db.load_reading_position('/test/document.pdf')
    if loaded:
        print(f"✅ Load test: Success - Word index: {loaded['last_word_index']}")
    else:
        print("❌ Load test: Failed")

    # Test update
    success = db.update_reading_position('/test/document.pdf', 2000, 6000)
    print(f"✅ Update test: {'Success' if success else 'Failed'}")

    # Test get saved documents
    docs = db.get_saved_documents()
    print(f"✅ Get saved documents: {len(docs)} document(s)")

    # Test statistics
    stats = db.get_statistics()
    print(f"✅ Statistics: {stats['total_documents']} docs, {stats['total_words_read']} words")

    # Test delete
    success = db.delete_reading_position('/test/document.pdf')
    print(f"✅ Delete test: {'Success' if success else 'Failed'}")

    print("\n✅ All tests completed!")


if __name__ == '__main__':
    test_database()


