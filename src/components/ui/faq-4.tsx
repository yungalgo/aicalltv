import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"

const faqs = [
  {
    question: "How does it work?",
    answer:
      "Simply select a caller, provide details about who you want to call, and our AI will make a personalized prank call. After the call, we'll generate a video of the conversation that you can download and share.",
  },
  {
    question: "How much does each call cost?",
    answer:
      "Each call costs $9.00 USD (or equivalent) as a one-time payment. You can pay with: $9.00 USD via credit card (Stripe), $9.00 USDC on Base or Solana, approximately 0.0257 ZEC on Zcash (ZEC is currently ~$350), or 0.01 ZTF on Ztarknet testnet (free - get ZTF from the faucet). No subscriptions, no hidden fees.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept multiple payment methods: Credit cards via Stripe ($9.00 USD), USDC cryptocurrency on Base or Solana ($9.00 USDC), Zcash shielded payments (0.0257 ZEC ≈ $9.00, ZEC is currently ~$350), and Ztarknet testnet payments (0.01 ZTF - free testnet tokens available from the faucet at https://faucet.ztarknet.cash/). All payments are one-time only, no subscriptions required.",
  },
  {
    question: "How long does it take to receive my video?",
    answer:
      "Typically, videos are generated within 5-15 minutes after the call completes. You'll receive a notification when your video is ready to download.",
  },
  {
    question: "Can I customize the caller's personality?",
    answer:
      "Yes! Each caller has a unique personality, speaking style, and appearance. You can browse our collection and select the caller that best fits your prank call idea.",
  },
  {
    question: "Is this legal?",
    answer:
      "Prank calls can be legal when done in good fun and with consent. However, we require users to agree to our Terms of Service which prohibit harassment, threats, or illegal activities. Always use responsibly.",
  },
  {
    question: "Is my personal information safe?",
    answer:
      "Yes! We take privacy seriously. Your phone number is always encrypted - you can choose standard encryption (stored securely in our database) or Fhenix FHE encryption (encrypted on-chain on Base Sepolia before it reaches our servers). With Fhenix, your phone number is encrypted in your browser before we ever see it, and stored encrypted on the blockchain. Even if our database is compromised, your data remains protected. We only decrypt it when needed to make your call.",
  },
  {
    question: "What if I don't want to share my personal info?",
    answer:
      "We understand privacy concerns! That's why we offer Fhenix FHE encryption - a privacy-first option that encrypts your phone number on-chain before it reaches our servers. When you use Fhenix mode, your phone number is encrypted in your browser using your Base wallet and stored encrypted on the blockchain. We can't see your phone number until it's decrypted for the call. You'll need to connect a Base wallet (like MetaMask) to use this feature. Your privacy is our priority.",
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
