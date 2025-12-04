import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"

const faqs = [
  {
    question: "how does it work?",
    answer:
      "1) pick a caller with a unique ai personality. 2) fill in details about your friend (powered by near ai assistant). 3) pay with crypto or card. 4) ai makes the call using natural conversation. 5) video is generated and emailed to you instantly. that's it!",
  },
  {
    question: "what ai powers the calls?",
    answer:
      "we use near ai to power our intelligent form assistant that helps you fill in call details naturally through conversation. the actual calls use advanced text-to-speech and conversation ai to create realistic, hilarious prank calls with unique caller personalities.",
  },
  {
    question: "what payment methods do you accept?",
    answer:
      "we're fully web3-native with multiple options: credit card via stripe ($5 usd), usdc on base or solana ($5 usdc), zcash shielded payments (~0.014 zec), and ztarknet testnet (0.01 ztf - free testnet tokens from faucet). pay however you're comfortable - crypto or traditional.",
  },
  {
    question: "how fast do i get my video?",
    answer:
      "videos are generated within 5-15 minutes after the call completes and emailed directly to you. you can also view and download all your videos in the 'your calls' section once logged in. no waiting around - prank, generate, share!",
  },
  {
    question: "what if they don't answer or it's the middle of the night?",
    answer:
      "no worries! we have smart retry logic built in. if your friend doesn't pick up, we'll automatically try again once or twice a day during normal hours (not at 3am!) until they answer. your prank will get through - we're persistent like that.",
  },
  {
    question: "what makes the callers unique?",
    answer:
      "each ai caller has a distinct personality, voice, speaking style, and appearance. from comedians to celebrities to original characters - pick the perfect vibe for your prank. the ai adapts to each personality naturally during the call.",
  },
  {
    question: "is my data safe?",
    answer:
      "yes! standard mode encrypts your data in our secure database. but we also offer optional fhenix fhe (fully homomorphic encryption) - your phone number gets encrypted in your browser before it ever reaches our servers, then stored encrypted on-chain on base. even we can't see it until decryption for the call. maximum privacy for the paranoid.",
  },
  {
    question: "what is fhe encryption?",
    answer:
      "fhe (fully homomorphic encryption) via fhenix lets you encrypt sensitive data like phone numbers on-chain before our servers ever see it. it's stored encrypted on the base blockchain. when we need to make your call, we decrypt it just-in-time. this means even if our database is compromised, your pii stays protected. connect a base wallet (metamask) to enable this privacy-first option.",
  },
  {
    question: "why web3 payments?",
    answer:
      "web3 payments offer privacy (zcash shielded transactions), low fees (solana/base usdc), and global access without banking restrictions. plus ztarknet testnet lets you try it free! but we also accept regular credit cards via stripe if you prefer traditional payments.",
  },
  {
    question: "is this legal?",
    answer:
      "prank calls are legal when done in good fun. our terms prohibit harassment, threats, or illegal activities. use responsibly and keep it lighthearted!",
  },
]

export function Component() {
  return (
    <section id="faq">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto space-y-4 py-6 text-center">
          <div className="inline-block rounded-2xl border-2 px-8 py-4" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            <h2 className="font-mono text-[14px] font-medium tracking-tight" style={{ color: '#1A1A1A', opacity: 0.7 }}>
              faq
            </h2>
            <h4 className="mx-auto mb-2 max-w-3xl text-[42px] font-medium tracking-tighter text-balance" style={{ color: '#1A1A1A' }}>
              frequently asked questions
            </h4>
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 p-6" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
          <Accordion
            type="single"
            collapsible
            className="w-full"
          >
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} style={{ borderColor: '#1A1A1A' }}>
                <AccordionTrigger className="text-left" style={{ color: '#1A1A1A' }}>
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent style={{ color: '#1A1A1A', opacity: 0.8 }}>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
