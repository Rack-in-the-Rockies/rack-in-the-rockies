import { SectionHeader } from "@/components/section-header";
import { ContactForm } from "@/components/contact-form";

export const metadata = {
  title: "Contact | Rack in the Rockies",
  description: "Get in touch for events, bookings, or general inquiries.",
};

export default function ContactPage() {
  return (
    <main className="py-12 px-6 md:px-12">
      <div className="max-w-xl mx-auto">
        <SectionHeader
          tag="Connect"
          title="Get in touch"
          subtitle="Have a question, want to book an event, or just want to say hi? I'd love to hear from you."
        />
        <ContactForm />
      </div>
    </main>
  );
}
