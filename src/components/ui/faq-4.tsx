import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"

const faqs = [
  {
    question: "Is there a free plan?",
    answer:
      "Yes, we offer a free tier with basic features. You can use it as long as you like without paying.",
  },
  {
    question: "Do you offer any discounts?",
    answer:
      "We have discounts for students and non-profits. Contact us to learn more.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "You can cancel anytime in your account settings. You'll keep access until your current billing period ends.",
  },
  {
    question: "What happens if I switch to a lower-priced plan?",
    answer:
      "You'll lose access to premium features right away. Your data stays safe, but you might need to reduce usage to fit the new plan limits.",
  },
  {
    question: "Can I change my plan?",
    answer:
      "Yes, you can change plans anytime in your account settings. Changes start at your next billing date.",
  },
]

export function Component() {
  return (
    <section id="faq">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto space-y-4 py-6 text-center">
          <h2 className="text-primary font-mono text-[14px] font-medium tracking-tight">
            FAQ
          </h2>
          <h4 className="mx-auto mb-2 max-w-3xl text-[42px] font-medium tracking-tighter text-balance">
            Frequently Asked Questions
          </h4>
        </div>
        <Accordion
          type="single"
          collapsible
          className="mx-auto w-full max-w-2xl"
        >
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
