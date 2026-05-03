#!/usr/bin/env python3
"""
Chapter Weight Charts - Visualization for Chapter Weight Analysis
Generates pie charts, bar charts, and other visualizations
"""

import os
from typing import List, Optional
from dataclasses import dataclass

try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    import matplotlib.patches as mpatches
    import matplotlib.font_manager as fm
    # Prefer Arabic-capable fonts to avoid missing glyphs (e.g., U+FDF2 ALLAH LIGATURE)
    # Order matters: Matplotlib will try them in sequence.
    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.sans-serif'] = [
        'Amiri', 'Noto Naskh Arabic', 'Scheherazade New', 'Tahoma', 'Arial', 'DejaVu Sans'
    ]

    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("Warning: matplotlib not available. Chart generation will be disabled.")

# Arabic text support
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    ARABIC_SUPPORT = True
except ImportError:
    ARABIC_SUPPORT = False
    print("Warning: arabic-reshaper and python-bidi not available. Arabic text in charts may not display correctly.")

try:
    from chapter_weight_analyzer import ChapterWeight
except ImportError:
    print("Warning: chapter_weight_analyzer module not available")


class ChapterWeightChartGenerator:
    """Generates charts for chapter weight visualization"""

    def __init__(self, chapter_weights: List[ChapterWeight]):
        """
        Initialize chart generator

        Args:
            chapter_weights: List of ChapterWeight objects
        """
        self.chapter_weights = chapter_weights

        if not MATPLOTLIB_AVAILABLE:
            raise ImportError("matplotlib is required for chart generation")

    @staticmethod
    def fix_arabic_text(text: str) -> str:
        """
        Fix Arabic text for proper display in matplotlib

        Args:
            text: Input text (may contain Arabic)

        Returns:
            Properly shaped text for display
        """
        if not ARABIC_SUPPORT:
            return text

        try:
            # Normalize special Arabic ligatures to standard letters to avoid missing glyphs
            # e.g., U+FDF2 ARABIC LIGATURE ALLAH ISOLATED FORM
            text = text.replace('\ufdf2', 'الله')

            # Check if text contains Arabic characters
            if any('\u0600' <= char <= '\u06FF' for char in text):
                reshaped_text = arabic_reshaper.reshape(text)
                bidi_text = get_display(reshaped_text)
                return bidi_text
            return text
        except Exception as e:
            print(f"Warning: Failed to reshape Arabic text: {e}")
            return text

    def generate_pie_chart(self, output_path: str, title: str = "Chapter Weight Distribution") -> bool:
        """
        Generate a pie chart showing chapter weight distribution

        Args:
            output_path: Path to save the chart image
            title: Chart title

        Returns:
            True if successful, False otherwise
        """
        try:
            # Prepare data
            labels = []
            sizes = []

            for cw in self.chapter_weights:
                # Truncate long titles
                label = cw.title if len(cw.title) <= 30 else cw.title[:27] + "..."
                # Fix Arabic text
                label = self.fix_arabic_text(label)
                labels.append(f"{label}\n({cw.page_count}p)")
                sizes.append(cw.page_count)

            # Create figure
            fig, ax = plt.subplots(figsize=(12, 8))

            # Generate colors
            colors = plt.cm.Set3(range(len(sizes)))

            # Create pie chart
            wedges, texts, autotexts = ax.pie(
                sizes,
                labels=None,  # We'll use legend instead
                autopct='%1.1f%%',
                colors=colors,
                startangle=90,
                textprops={'fontsize': 9}
            )

            # Make percentage text bold
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontweight('bold')

            # Add legend
            legend_title = self.fix_arabic_text("Chapters")
            ax.legend(
                wedges,
                labels,
                title=legend_title,
                loc="center left",
                bbox_to_anchor=(1, 0, 0.5, 1),
                fontsize=8
            )

            # Fix title for Arabic
            fixed_title = self.fix_arabic_text(title)
            ax.set_title(fixed_title, fontsize=14, fontweight='bold', pad=20)

            # Equal aspect ratio ensures that pie is drawn as a circle
            ax.axis('equal')

            plt.tight_layout()
            plt.savefig(output_path, dpi=300, bbox_inches='tight')
            plt.close()

            return True

        except Exception as e:
            print(f"Error generating pie chart: {e}")
            return False

    def generate_bar_chart(self, output_path: str, title: str = "Chapter Page Distribution") -> bool:
        """
        Generate a horizontal bar chart showing chapter page counts

        Args:
            output_path: Path to save the chart image
            title: Chart title

        Returns:
            True if successful, False otherwise
        """
        try:
            # Prepare data
            labels = []
            pages = []

            for cw in self.chapter_weights:
                # Truncate long titles
                label = cw.title if len(cw.title) <= 40 else cw.title[:37] + "..."
                # Fix Arabic text
                label = self.fix_arabic_text(label)
                labels.append(label)
                pages.append(cw.page_count)

            # Create figure
            fig, ax = plt.subplots(figsize=(10, max(6, len(labels) * 0.4)))

            # Generate colors based on page count
            colors = plt.cm.viridis([p / max(pages) for p in pages])

            # Create horizontal bar chart
            y_pos = range(len(labels))
            bars = ax.barh(y_pos, pages, color=colors)

            # Add value labels on bars
            for i, (bar, page_count) in enumerate(zip(bars, pages)):
                width = bar.get_width()
                ax.text(
                    width + max(pages) * 0.01,
                    bar.get_y() + bar.get_height() / 2,
                    f'{page_count}p',
                    ha='left',
                    va='center',
                    fontsize=9,
                    fontweight='bold'
                )

            ax.set_yticks(y_pos)
            ax.set_yticklabels(labels, fontsize=9)
            # Fix axis labels for Arabic
            xlabel = self.fix_arabic_text('Number of Pages')
            ax.set_xlabel(xlabel, fontsize=11, fontweight='bold')
            fixed_title = self.fix_arabic_text(title)
            ax.set_title(fixed_title, fontsize=14, fontweight='bold', pad=20)
            ax.grid(axis='x', alpha=0.3, linestyle='--')

            plt.tight_layout()
            plt.savefig(output_path, dpi=300, bbox_inches='tight')
            plt.close()

            return True

        except Exception as e:
            print(f"Error generating bar chart: {e}")
            return False

    def generate_weight_comparison_chart(self, output_path: str, title: str = "Chapter Weight Comparison") -> bool:
        """
        Generate a chart comparing chapter weights with percentages

        Args:
            output_path: Path to save the chart image
            title: Chart title

        Returns:
            True if successful, False otherwise
        """
        try:
            # Prepare data
            labels = []
            weights = []

            for cw in self.chapter_weights:
                label = cw.title if len(cw.title) <= 35 else cw.title[:32] + "..."
                # Fix Arabic text
                label = self.fix_arabic_text(label)
                labels.append(label)
                weights.append(cw.weight_percentage)

            # Create figure
            fig, ax = plt.subplots(figsize=(12, max(6, len(labels) * 0.4)))

            # Generate colors
            colors = plt.cm.coolwarm([w / max(weights) for w in weights])

            # Create horizontal bar chart
            y_pos = range(len(labels))
            bars = ax.barh(y_pos, weights, color=colors)

            # Add percentage labels
            for bar, weight in zip(bars, weights):
                width = bar.get_width()
                ax.text(
                    width + max(weights) * 0.01,
                    bar.get_y() + bar.get_height() / 2,
                    f'{weight:.1f}%',
                    ha='left',
                    va='center',
                    fontsize=9,
                    fontweight='bold'
                )

            ax.set_yticks(y_pos)
            ax.set_yticklabels(labels, fontsize=9)
            # Fix axis labels for Arabic
            xlabel = self.fix_arabic_text('Weight Percentage (%)')
            ax.set_xlabel(xlabel, fontsize=11, fontweight='bold')
            fixed_title = self.fix_arabic_text(title)
            ax.set_title(fixed_title, fontsize=14, fontweight='bold', pad=20)
            ax.grid(axis='x', alpha=0.3, linestyle='--')

            # Add average line
            avg_weight = sum(weights) / len(weights)
            avg_label = self.fix_arabic_text(f'Average: {avg_weight:.1f}%')
            ax.axvline(avg_weight, color='red', linestyle='--', linewidth=2, alpha=0.7, label=avg_label)
            ax.legend(loc='lower right')

            plt.tight_layout()
            plt.savefig(output_path, dpi=300, bbox_inches='tight')
            plt.close()

            return True

        except Exception as e:
            print(f"Error generating weight comparison chart: {e}")
            return False

    def generate_combined_report(self, output_dir: str, base_filename: str = "chapter_analysis") -> bool:
        """
        Generate all charts and save them to a directory

        Args:
            output_dir: Directory to save charts
            base_filename: Base filename for charts

        Returns:
            True if all charts generated successfully
        """
        try:
            os.makedirs(output_dir, exist_ok=True)

            success = True

            # Generate pie chart
            pie_path = os.path.join(output_dir, f"{base_filename}_pie.png")
            success &= self.generate_pie_chart(pie_path)

            # Generate bar chart
            bar_path = os.path.join(output_dir, f"{base_filename}_bar.png")
            success &= self.generate_bar_chart(bar_path)

            # Generate weight comparison
            weight_path = os.path.join(output_dir, f"{base_filename}_weights.png")
            success &= self.generate_weight_comparison_chart(weight_path)

            return success

        except Exception as e:
            print(f"Error generating combined report: {e}")
            return False


def is_matplotlib_available() -> bool:
    """Check if matplotlib is available"""
    return MATPLOTLIB_AVAILABLE

