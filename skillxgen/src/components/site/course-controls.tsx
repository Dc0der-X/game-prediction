"use client";
import { ActionForm, InlineAction, SubmitButton } from "@/components/form";
import { enrolFree, markLessonComplete } from "@/app/learning-actions";

export function EnrolFreeButton({ courseId, slug }: { courseId: string; slug: string }) {
  return (
    <ActionForm action={enrolFree} data-testid="enrol-free">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="slug" value={slug} />
      <SubmitButton pendingLabel="Enrolling…">Enrol free and save progress</SubmitButton>
    </ActionForm>
  );
}

export function CompleteLessonButton({ lessonId, next, done }: { lessonId: string; next?: string; done: boolean }) {
  return (
    <InlineAction action={markLessonComplete} fields={{ lesson_id: lessonId, next: next ?? "" }} variant={done ? "outline" : "default"} size="default" data-testid="complete-lesson">
      {done ? "Completed ✓ — continue" : next ? "Mark complete and continue" : "Mark complete"}
    </InlineAction>
  );
}
