#!/usr/bin/env python3
"""
Study Plan Calculator - حاسبة خطة المذاكرة الذكية المحسنة
إصلاح مشكلة التوزيع غير العادل للأيام
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import math


@dataclass
class Chapter:
    """معلومات الفصل"""
    title: str
    level: int
    start_page: int
    end_page: int
    page_count: int
    parent_title: Optional[str] = None


@dataclass
class StudySession:
    """جلسة مذاكرة واحدة"""
    block_number: int
    chapter_title: str
    start_page: int
    end_page: int
    page_count: int
    assigned_days: int
    start_date: str
    end_date: str
    merged_chapters: Optional[List[str]] = None
    daily_pages: float = 0.0
    weight_percentage: float = 0.0


class FairStudyPlanCalculator:
    """
    حاسبة خطة المذاكرة العادلة

    المنهجية الجديدة:
    1. حساب الصفحات اليومية المستهدفة
    2. توزيع الأيام بناءً على عدد الصفحات فقط
    3. التأكد من أن الفصول الأكبر تحصل على أيام أكثر
    """

    def __init__(
            self,
            chapters: List[Chapter],
            total_days: int,
            start_date: Optional[datetime] = None,
            skip_weekends: bool = False,
            weekend_days: Optional[List[int]] = None
    ):
        """
        Args:
            chapters: قائمة الفصول
            total_days: إجمالي أيام المذاكرة
            start_date: تاريخ البدء (افتراضي: اليوم)
            skip_weekends: تجاوز عطلة نهاية الأسبوع
            weekend_days: أيام العطلة (افتراضي: الجمعة والسبت)
        """
        # تصفية الفصول الفارغة وترتيبها
        self.chapters = sorted(
            [ch for ch in chapters if ch.page_count > 0],
            key=lambda x: x.start_page
        )
        self.total_days = max(1, total_days)
        self.start_date = start_date or datetime.now()
        self.skip_weekends = skip_weekends
        self.weekend_days = weekend_days if weekend_days is not None else [4, 5]

        # إجمالي الصفحات
        self.total_pages = sum(ch.page_count for ch in self.chapters)

    def calculate_plan(self) -> List[StudySession]:
        """حساب خطة المذاكرة الكاملة"""

        if not self.chapters or self.total_days <= 0 or self.total_pages == 0:
            return []

        print(f"بدء حساب خطة المذاكرة:")
        print(f"إجمالي الصفحات: {self.total_pages}")
        print(f"إجمالي الأيام: {self.total_days}")

        # الخطوة 1: حساب الصفحات اليومية المستهدفة
        target_pages_per_day = self.total_pages / self.total_days
        print(f"الصفحات اليومية المستهدفة: {target_pages_per_day:.2f}")

        # الخطوة 2: حساب الأيام المطلوبة لكل فصل بشكل عادل
        study_plan = self._calculate_fair_distribution(target_pages_per_day)

        return study_plan

    def _calculate_fair_distribution(self, target_pages_per_day: float) -> List[StudySession]:
        """توزيع عادل للأيام بناءً على الصفحات فقط"""

        # أولاً: حساب الأيام المثالية لكل فصل
        ideal_days = []
        for ch in self.chapters:
            exact_days = ch.page_count / target_pages_per_day
            ideal_days.append({
                'chapter': ch,
                'exact_days': exact_days,
                'min_days': math.floor(exact_days),  # الحد الأدنى (تم التعديل)
                'max_days': math.ceil(exact_days),  # الحد الأقصى (تم التعديل)
                'priority': exact_days - math.floor(exact_days)  # الأولوية للكسور الأعلى
            })

        # البدء بالحد الأدنى من الأيام
        assigned_days = [item['min_days'] for item in ideal_days]
        total_assigned = sum(assigned_days)
        remaining_days = self.total_days - total_assigned

        print(f"\nتوزيع الأيام الأولي:")
        for i, item in enumerate(ideal_days):
            print(f"{item['chapter'].title}: {item['exact_days']:.2f} يوم مثالي -> {assigned_days[i]} يوم مخصص")
        print(f"الأيام المخصصة: {total_assigned}, الأيام المتبقية: {remaining_days}")

        # توزيع الأيام المتبقية بشكل عادل
        if remaining_days > 0:
            # إعطاء الأولوية للفصول ذات الكسور الأعلى
            sorted_by_priority = sorted(
                enumerate(ideal_days),
                key=lambda x: (x[1]['priority'], x[1]['chapter'].page_count),
                reverse=True
            )

            for i, (idx, item) in enumerate(sorted_by_priority):
                if i < remaining_days and assigned_days[idx] < item['max_days']:
                    assigned_days[idx] += 1
                    print(f"إضافة يوم لـ {item['chapter'].title} (الأولوية: {item['priority']:.2f})")

        elif remaining_days < 0:
            # إزالة الأيام من الفصول ذات الكسور الأدنى
            sorted_by_priority = sorted(
                enumerate(ideal_days),
                key=lambda x: (x[1]['priority'], x[1]['chapter'].page_count)
            )

            for i, (idx, item) in enumerate(sorted_by_priority):
                if i < abs(remaining_days) and assigned_days[idx] > item['min_days']:
                    assigned_days[idx] -= 1
                    print(f"إزالة يوم من {item['chapter'].title} (الأولوية: {item['priority']:.2f})")

        # الخطوة 3: تجميع الفصول المتجاورة التي خصص لها نفس عدد الأيام (تم التعديل)
        final_groups = self._group_chapters(ideal_days, assigned_days)

        # الخطوة 4: إنشاء جدول المذاكرة
        return self._generate_schedule(final_groups)

    def _group_chapters(self, ideal_days: List[Dict], assigned_days: List[int]) -> List[Dict]:
        """تجميع الفصول المتجاورة التي خصص لها نفس عدد الأيام"""
        groups = []
        current_group = None

        for i, (item, days) in enumerate(zip(ideal_days, assigned_days)):
            ch = item['chapter']

            # دمج الفصول المتجاورة التي لها نفس عدد الأيام المخصصة
            if current_group and days == current_group['assigned_days']:
                current_group['chapters'].append(ch)
                current_group['total_pages'] += ch.page_count
                current_group['exact_days'] += item['exact_days']
            else:
                if current_group:
                    # إذا كانت المجموعة الحالية حصلت على 0 أيام مخصصة، خصص لها يومًا واحدًا
                    if current_group['assigned_days'] == 0 and current_group['total_pages'] > 0:
                        current_group['assigned_days'] = 1
                    groups.append(current_group)

                # بدء مجموعة جديدة
                current_group = {
                    'chapters': [ch],
                    'total_pages': ch.page_count,
                    'assigned_days': days,
                    'exact_days': item['exact_days']
                }

        # حفظ المجموعة الأخيرة
        if current_group:
            # إذا كانت المجموعة الحالية حصلت على 0 أيام مخصصة، خصص لها يومًا واحدًا
            if current_group['assigned_days'] == 0 and current_group['total_pages'] > 0:
                current_group['assigned_days'] = 1
            groups.append(current_group)

        # طباعة معلومات المجموعات النهائية
        print(f"\nالمجموعات النهائية:")
        for i, group in enumerate(groups):
            chapter_names = [ch.title for ch in group['chapters']]
            print(f"المجموعة {i + 1}: {chapter_names} - {group['total_pages']} صفحة - {group['assigned_days']} يوم")

        return groups

    def _generate_schedule(self, groups: List[Dict]) -> List[StudySession]:
        """إنشاء جدول المذاكرة مع التواريخ"""
        schedule = []
        current_date = self.start_date

        for i, group in enumerate(groups):
            if group['assigned_days'] == 0:
                continue

            current_date = self._skip_to_reading_day(current_date)
            end_date = self._calculate_end_date(current_date, group['assigned_days'])

            chapters = group['chapters']
            if len(chapters) == 1:
                title = chapters[0].title
                merged_titles = None
            else:
                title = f"{chapters[0].title} – {chapters[-1].title}"
                merged_titles = [ch.title for ch in chapters]

            daily_pages = group['total_pages'] / group['assigned_days']
            weight_percentage = (group['total_pages'] / self.total_pages) * 100

            session = StudySession(
                block_number=i + 1,
                chapter_title=title,
                start_page=chapters[0].start_page,
                end_page=chapters[-1].end_page,
                page_count=group['total_pages'],
                assigned_days=group['assigned_days'],
                start_date=current_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d"),
                merged_chapters=merged_titles,
                daily_pages=round(daily_pages, 2),
                weight_percentage=round(weight_percentage, 2)
            )

            schedule.append(session)

            current_date = end_date + timedelta(days=1)

        return schedule

    def _skip_to_reading_day(self, date: datetime) -> datetime:
        """تجاوز أيام العطلة"""
        if not self.skip_weekends:
            return date

        while date.weekday() in self.weekend_days:
            date += timedelta(days=1)
        return date

    def _calculate_end_date(self, start_date: datetime, days: int) -> datetime:
        """حساب تاريخ الانتهاء مع احترام أيام العطلة"""
        if not self.skip_weekends:
            return start_date + timedelta(days=days - 1)

        current_date = start_date
        reading_days_count = 0

        while reading_days_count < days:
            if current_date.weekday() not in self.weekend_days:
                reading_days_count += 1

            if reading_days_count < days:
                current_date += timedelta(days=1)

        return current_date


def create_sample_chapters():
    """إنشاء فصول تجريبية مشابهة للمثال المذكور"""
    chapters = [
        Chapter(title="تقديم الكتاب", level=1, start_page=5, end_page=10, page_count=6),
        Chapter(title="ترجمة المؤلف", level=1, start_page=11, end_page=15, page_count=5),
        Chapter(title="مقدمة التحقيق", level=1, start_page=16, end_page=20, page_count=5),
        Chapter(title="مقدمة المؤلف", level=1, start_page=21, end_page=25, page_count=5),
        Chapter(title="كتاب الطهارة", level=1, start_page=26, end_page=40, page_count=15),
        Chapter(title="كتاب الصلاة", level=1, start_page=41, end_page=74, page_count=34),
    ]
    return chapters


def example_usage():
    """مثال على استخدام الحاسبة المحسنة"""

    # إنشاء فصول تجريبية
    chapters = create_sample_chapters()

    # إنشاء خطة لمدة 3 أيام (مشابهة للمثال)
    calculator = FairStudyPlanCalculator(
        chapters=chapters,
        total_days=3,
        start_date=datetime(2025, 10, 24),
        skip_weekends=True,
        weekend_days=[4, 5]  # الجمعة والسبت
    )

    # حساب الخطة
    schedule = calculator.calculate_plan()

    # طباعة الخطة
    print("\n" + "=" * 80)
    print("خطة المذاكرة النهائية")
    print("=" * 80)

    day_counter = 1
    for session in schedule:
        start_day = day_counter
        end_day = day_counter + session.assigned_days - 1
        day_range = f"اليوم {start_day}" if session.assigned_days == 1 else f"الأيام {start_day}-{end_day}"

        print(f"\nالمجموعة {session.block_number} ({day_range}) - {session.start_date} إلى {session.end_date}")
        print(f"الفصل: {session.chapter_title}")

        if session.merged_chapters and len(session.merged_chapters) > 1:
            print(f"  (يشمل: {', '.join(session.merged_chapters)})")

        print(f"الصفحات: {session.start_page}-{session.end_page} ({session.page_count} صفحة)")
        print(f"المدة: {session.assigned_days} يوم(أيام)")
        print(f"الوزن: {session.weight_percentage}%")
        print(f"المعدل اليومي: {session.daily_pages} صفحة/يوم")

        day_counter = end_day + 1


if __name__ == "__main__":
    example_usage()
