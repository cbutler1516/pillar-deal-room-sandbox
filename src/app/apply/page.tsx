import { ApplicationForm } from "@/components/application-form";

export const dynamic = "force-dynamic";

export default function ApplyPage() {
  return (
    <div className="min-h-full bg-workspace px-4 py-10">
      <ApplicationForm />
    </div>
  );
}
