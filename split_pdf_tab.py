"""
Split PDF Tab - Allows users to split a PDF file at specific page numbers with preview functionality
"""

import os
import fitz  # PyMuPDF
from typing import List, Optional
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QLineEdit, QGroupBox, QFileDialog, QMessageBox, QScrollArea,
    QGridLayout, QDialog, QDialogButtonBox
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap


class SplitPreviewDialog(QDialog):
    """Dialog to preview pages where PDF will be split"""
    
    def __init__(self, pdf_path: str, split_pages: List[int], total_pages: int, localization=None, parent=None):
        super().__init__(parent)
        self.pdf_path = pdf_path
        self.split_pages = sorted(split_pages)
        self.total_pages = total_pages
        self.localization = localization
        
        self.setWindowTitle(self.localization.get_text("split_preview_title") if self.localization else "Split Preview")
        self.setMinimumSize(800, 600)
        
        self.init_ui()
        self.load_previews()
    
    def init_ui(self):
        """Initialize preview dialog UI"""
        layout = QVBoxLayout(self)
        
        # Info label
        num_files = len(self.split_pages) + 1
        info_text = self.localization.get_text("output_files_will_be").format(num_files) if self.localization else f"{num_files} files will be created:"
        info_label = QLabel(info_text)
        info_label.setStyleSheet("font-weight: bold; font-size: 12pt; padding: 10px;")
        layout.addWidget(info_label)
        
        # File parts info
        parts_info = self._generate_parts_info()
        parts_label = QLabel(parts_info)
        parts_label.setWordWrap(True)
        parts_label.setStyleSheet("padding: 10px; background-color: #E3F2FD; border-radius: 4px;")
        layout.addWidget(parts_label)
        
        # Scroll area for previews
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        scroll_widget = QWidget()
        self.preview_layout = QGridLayout(scroll_widget)
        self.preview_layout.setSpacing(15)
        
        scroll.setWidget(scroll_widget)
        layout.addWidget(scroll)
        
        # Buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok)
        button_box.accepted.connect(self.accept)
        layout.addWidget(button_box)
    
    def _generate_parts_info(self) -> str:
        """Generate information about the file parts that will be created"""
        parts = []
        start_page = 1
        
        for i, split_page in enumerate(self.split_pages):
            part_num = i + 1
            end_page = split_page
            part_text = self.localization.get_text("file_part").format(part_num) if self.localization else f"Part {part_num}"
            pages_text = self.localization.get_text("pages_range").format(start_page, end_page) if self.localization else f"Pages {start_page} - {end_page}"
            parts.append(f"• {part_text}: {pages_text}")
            start_page = split_page + 1
        
        # Last part
        part_num = len(self.split_pages) + 1
        part_text = self.localization.get_text("file_part").format(part_num) if self.localization else f"Part {part_num}"
        pages_text = self.localization.get_text("pages_range").format(start_page, self.total_pages) if self.localization else f"Pages {start_page} - {self.total_pages}"
        parts.append(f"• {part_text}: {pages_text}")
        
        return "<br>".join(parts)
    
    def load_previews(self):
        """Load and display page previews"""
        try:
            doc = fitz.open(self.pdf_path)
            
            col = 0
            row = 0
            max_cols = 3
            
            for page_num in self.split_pages:
                # Create preview widget
                preview_widget = QWidget()
                preview_layout = QVBoxLayout(preview_widget)
                preview_layout.setContentsMargins(5, 5, 5, 5)
                
                # Page label
                page_label_text = self.localization.get_text("split_at_page").format(page_num) if self.localization else f"Split at Page {page_num}"
                page_label = QLabel(page_label_text)
                page_label.setStyleSheet("font-weight: bold; color: #1976D2;")
                page_label.setAlignment(Qt.AlignCenter)
                preview_layout.addWidget(page_label)
                
                # Render page preview
                page = doc[page_num - 1]  # 0-indexed
                mat = fitz.Matrix(0.5, 0.5)  # Scale down for preview
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                
                pixmap = QPixmap()
                pixmap.loadFromData(img_data)
                
                # Display preview
                preview_label = QLabel()
                preview_label.setPixmap(pixmap)
                preview_label.setAlignment(Qt.AlignCenter)
                preview_label.setStyleSheet("border: 2px solid #1976D2; background-color: white; padding: 5px;")
                preview_layout.addWidget(preview_label)
                
                # Add to grid
                self.preview_layout.addWidget(preview_widget, row, col)
                
                col += 1
                if col >= max_cols:
                    col = 0
                    row += 1
            
            doc.close()
            
        except Exception as e:
            error_label = QLabel(f"Error loading previews: {str(e)}")
            error_label.setStyleSheet("color: red; padding: 20px;")
            self.preview_layout.addWidget(error_label, 0, 0)


class SplitPDFTab(QWidget):
    """Tab for splitting PDF files at specific page numbers"""
    
    def __init__(self, history_manager=None, localization=None, parent=None):
        super().__init__(parent)
        self.history_manager = history_manager
        self.localization = localization
        self.pdf_path = ""
        self.total_pages = 0
        
        self.init_ui()
    
    def init_ui(self):
        """Initialize split PDF tab UI"""
        layout = QVBoxLayout(self)
        
        # Instructions
        instructions = QLabel(self.localization.get_text("split_desc") if self.localization else "Split PDF")
        instructions.setWordWrap(True)
        instructions.setStyleSheet("color: #5D4037; padding: 8px; background-color: #EFEBE9; border-radius: 4px;")
        layout.addWidget(instructions)
        
        # File selection group
        file_group = QGroupBox(self.localization.get_text("select_pdf_to_split") if self.localization else "Select PDF to Split")
        file_layout = QVBoxLayout(file_group)
        
        # File path display and button
        file_select_layout = QHBoxLayout()
        
        self.file_path_label = QLabel(self.localization.get_text("no_file_selected") if self.localization else "No file selected")
        self.file_path_label.setStyleSheet("padding: 8px; background-color: #f5f5f5; border: 1px solid #ccc; border-radius: 4px;")
        file_select_layout.addWidget(self.file_path_label, 1)
        
        self.btn_select_file = QPushButton(self.localization.get_text("select_pdf_file") if self.localization else "Select PDF")
        self.btn_select_file.clicked.connect(self.select_pdf_file)
        file_select_layout.addWidget(self.btn_select_file)
        
        file_layout.addLayout(file_select_layout)
        
        # Total pages display
        self.total_pages_label = QLabel("")
        self.total_pages_label.setStyleSheet("font-weight: bold; color: #1976D2; padding: 5px;")
        file_layout.addWidget(self.total_pages_label)
        
        layout.addWidget(file_group)
        
        # Split points group
        split_group = QGroupBox(self.localization.get_text("split_points") if self.localization else "Split Points")
        split_layout = QVBoxLayout(split_group)
        
        # Split points input
        split_label = QLabel(self.localization.get_text("split_points_label") if self.localization else "Page numbers to split at:")
        split_layout.addWidget(split_label)
        
        self.split_input = QLineEdit()
        self.split_input.setPlaceholderText(self.localization.get_text("split_points_placeholder") if self.localization else "Example: 5, 10, 15")
        self.split_input.setStyleSheet("padding: 8px; font-size: 11pt;")
        split_layout.addWidget(self.split_input)
        
        # Preview and split buttons
        buttons_layout = QHBoxLayout()
        
        self.btn_preview = QPushButton(self.localization.get_text("preview_split_points") if self.localization else "Preview Split Points")
        self.btn_preview.clicked.connect(self.preview_split_points)
        self.btn_preview.setEnabled(False)
        self.btn_preview.setStyleSheet("QPushButton { background-color: #2196F3; color: white; font-weight: bold; padding: 10px; }")
        buttons_layout.addWidget(self.btn_preview)
        
        self.btn_split = QPushButton(self.localization.get_text("split_pdf_btn") if self.localization else "Split PDF")
        self.btn_split.clicked.connect(self.split_pdf)
        self.btn_split.setEnabled(False)
        self.btn_split.setStyleSheet("QPushButton { background-color: #4CAF50; color: white; font-weight: bold; padding: 10px; }")
        buttons_layout.addWidget(self.btn_split)
        
        split_layout.addLayout(buttons_layout)
        layout.addWidget(split_group)
        
        # Info group
        info_group = QGroupBox(self.localization.get_text("split_info") if self.localization else "Split Information")
        info_layout = QVBoxLayout(info_group)
        
        info_text = QLabel(self.localization.get_text("split_instructions") if self.localization else "Instructions")
        info_text.setWordWrap(True)
        info_text.setStyleSheet("color: #666; padding: 10px;")
        info_layout.addWidget(info_text)
        
        layout.addWidget(info_group)

        # Add stretch
        layout.addStretch()

    def select_pdf_file(self):
        """Select PDF file to split"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            self.localization.get_text("select_pdf_file") if self.localization else "Select PDF File",
            "",
            "PDF Files (*.pdf)"
        )

        if file_path:
            try:
                # Open PDF to get page count
                doc = fitz.open(file_path)
                self.total_pages = len(doc)
                doc.close()

                self.pdf_path = file_path
                self.file_path_label.setText(os.path.basename(file_path))

                # Update total pages label
                total_text = self.localization.get_text("total_pages").format(self.total_pages) if self.localization else f"Total Pages: {self.total_pages}"
                self.total_pages_label.setText(total_text)

                # Enable buttons
                self.btn_preview.setEnabled(True)
                self.btn_split.setEnabled(True)

            except Exception as e:
                QMessageBox.critical(
                    self,
                    self.localization.get_text("error") if self.localization else "Error",
                    f"Failed to open PDF: {str(e)}"
                )

    def parse_split_points(self) -> Optional[List[int]]:
        """Parse and validate split points from input"""
        split_text = self.split_input.text().strip()

        if not split_text:
            QMessageBox.warning(
                self,
                self.localization.get_text("invalid_split_points") if self.localization else "Invalid Split Points",
                self.localization.get_text("enter_valid_page_numbers") if self.localization else "Please enter valid page numbers"
            )
            return None

        try:
            # Parse comma-separated page numbers
            split_pages = []
            for part in split_text.split(','):
                page_num = int(part.strip())
                if page_num < 1 or page_num > self.total_pages:
                    error_msg = self.localization.get_text("page_numbers_out_of_range").format(self.total_pages) if self.localization else f"Page numbers must be between 1 and {self.total_pages}"
                    QMessageBox.warning(
                        self,
                        self.localization.get_text("invalid_split_points") if self.localization else "Invalid Split Points",
                        error_msg
                    )
                    return None
                split_pages.append(page_num)

            # Remove duplicates and sort
            split_pages = sorted(list(set(split_pages)))

            # Remove first and last page if present (can't split at these)
            split_pages = [p for p in split_pages if p != 1 and p != self.total_pages]

            if not split_pages:
                QMessageBox.warning(
                    self,
                    self.localization.get_text("invalid_split_points") if self.localization else "Invalid Split Points",
                    self.localization.get_text("enter_valid_page_numbers") if self.localization else "Please enter valid split points"
                )
                return None

            return split_pages

        except ValueError:
            QMessageBox.warning(
                self,
                self.localization.get_text("invalid_split_points") if self.localization else "Invalid Split Points",
                self.localization.get_text("enter_valid_page_numbers") if self.localization else "Please enter valid page numbers"
            )
            return None

    def preview_split_points(self):
        """Show preview of pages where PDF will be split"""
        if not self.pdf_path:
            QMessageBox.warning(
                self,
                self.localization.get_text("no_pdf_selected_for_split") if self.localization else "No PDF Selected",
                self.localization.get_text("select_pdf_file_first") if self.localization else "Please select a PDF file first"
            )
            return

        split_pages = self.parse_split_points()
        if split_pages:
            dialog = SplitPreviewDialog(self.pdf_path, split_pages, self.total_pages, self.localization, self)
            dialog.exec()

    def split_pdf(self):
        """Split PDF at specified page numbers"""
        if not self.pdf_path:
            QMessageBox.warning(
                self,
                self.localization.get_text("no_pdf_selected_for_split") if self.localization else "No PDF Selected",
                self.localization.get_text("select_pdf_file_first") if self.localization else "Please select a PDF file first"
            )
            return

        split_pages = self.parse_split_points()
        if not split_pages:
            return

        # Select output directory
        output_dir = QFileDialog.getExistingDirectory(
            self,
            self.localization.get_text("select_output_directory") if self.localization else "Select Output Directory",
            os.path.dirname(self.pdf_path)
        )

        if not output_dir:
            return

        try:
            # Open source PDF
            doc = fitz.open(self.pdf_path)
            base_name = os.path.splitext(os.path.basename(self.pdf_path))[0]

            # Create output files
            output_files = []
            start_page = 0
            part_num = 1

            for split_page in split_pages:
                # Create new PDF for this part
                output_pdf = fitz.open()
                output_pdf.insert_pdf(doc, from_page=start_page, to_page=split_page - 1)

                # Save part
                output_path = os.path.join(output_dir, f"{base_name}_part{part_num}.pdf")
                output_pdf.save(output_path)
                output_pdf.close()
                output_files.append(output_path)

                start_page = split_page
                part_num += 1

            # Create last part
            output_pdf = fitz.open()
            output_pdf.insert_pdf(doc, from_page=start_page, to_page=self.total_pages - 1)
            output_path = os.path.join(output_dir, f"{base_name}_part{part_num}.pdf")
            output_pdf.save(output_path)
            output_pdf.close()
            output_files.append(output_path)

            doc.close()

            # Add to history
            if self.history_manager:
                self.history_manager.add_entry(
                    operation="Split PDF",
                    input_files=[self.pdf_path],
                    output_file=output_dir,
                    status="Success",
                    details=f"Split into {len(output_files)} files at pages: {', '.join(map(str, split_pages))}"
                )

            # Show success message
            success_msg = self.localization.get_text("split_complete").format(len(output_files)) if self.localization else f"Successfully created {len(output_files)} files"
            QMessageBox.information(
                self,
                self.localization.get_text("pdfs_split_successfully") if self.localization else "Success",
                success_msg
            )

        except Exception as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error") if self.localization else "Error",
                f"Failed to split PDF: {str(e)}"
            )

