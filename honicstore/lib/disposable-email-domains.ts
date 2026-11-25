/**
 * Throwaway / temporary inbox services. Sign-up is refused for these so people can't create
 * spam accounts with inboxes that disappear (and so verification emails don't hurt sender reputation).
 * Matches the domain itself and any subdomain (e.g. "x.mailinator.com").
 * Add new ones here when they show up in sign-ups.
 */
const DISPOSABLE_DOMAINS = new Set([
  // Mailinator family
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailinater.com', 'reallymymail.com', 'binkmail.com',
  'bobmail.info', 'chammy.info', 'devnullmail.com', 'letthemeatspam.com', 'mailismagic.com', 'notmailinator.com',
  'safetymail.info', 'sogetthis.com', 'spamherelots.com', 'thisisnotmyrealemail.com', 'suremail.info', 'veryrealemail.com',
  // Guerrilla Mail family
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info',
  'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me',
  // 10 Minute Mail and similar
  '10minutemail.com', '10minutemail.net', '10minutemail.co.uk', '10minmail.com', '20minutemail.com', '30minutemail.com',
  'minutemail.com', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmail.dev', 'tempmailo.com',
  'tempmail.plus', 'tempmailaddress.com', 'tempinbox.com', 'tempr.email', 'temporarymail.com', 'tmpmail.org', 'tmpmail.net',
  'tmail.ws', 'tmails.net', 'tempemail.co', 'tempemail.net', 'emailtemporal.org', 'mohmal.com',
  // Yopmail family
  'yopmail.com', 'yopmail.net', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'courriel.fr.nf', 'moncourrier.fr.nf', 'speed.1s.fr',
  // Others commonly abused
  'throwawaymail.com', 'trashmail.com', 'trashmail.net', 'trashmail.de', 'trash-mail.com', 'trashmail.io', 'wegwerfmail.de',
  'wegwerfmail.net', 'dispostable.com', 'discard.email', 'discardmail.com', 'spambog.com', 'spamgourmet.com', 'spamex.com',
  'mailnesia.com', 'mailcatch.com', 'maildrop.cc', 'mailsac.com', 'mintemail.com', 'mytemp.email', 'getnada.com', 'nada.email',
  'getairmail.com', 'airmail.cc', 'fakeinbox.com', 'fakemail.net', 'fake-mail.net', 'emailondeck.com', 'burnermail.io',
  'inboxkitten.com', 'mailpoof.com', 'moakt.com', 'moakt.cc', 'tmpeml.com', 'emailfake.com', 'email-fake.com', 'fakemailgenerator.com',
  'armyspy.com', 'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com',
  'teleworm.us', 'spamdecoy.net', 'mailexpire.com', 'mail-temp.com', 'mailtemp.net', 'emltmp.com', 'mailto.plus', 'fexpost.com',
  'fexbox.org', 'mailbox.in.ua', 'rover.info', 'inpwa.com', 'intopwa.com', 'tofeat.com', 'chitthi.in', 'dropmail.me', '10mail.org',
  'emlpro.com', 'emlhub.com', 'freeml.net', 'yomail.info', 'linshiyouxiang.net', 'byom.de', 'harakirimail.com', 'mailforspam.com',
  'incognitomail.org', 'anonbox.net', 'spambox.us', 'jetable.org', 'mt2015.com', 'tempail.com', 'luxusmail.org', 'gmailnator.com',
  'emailnator.com', 'smailpro.com', 'tempmailer.com', 'mail.tm', 'mail.gw', 'tempmail.lol', 'crazymailing.com', 'mvrht.net',
  'mailnull.com', 'spamfree24.org', 'kurzepost.de', 'objectmail.com', 'proxymail.eu', 'rcpt.at', 'trash2009.com', 'trashymail.com',
  'mailmetrash.com', 'thankyou2010.com', 'trbvm.com', 'boximail.com', 'clrmail.com', 'eelmail.com', 'zetmail.com', 'vomoto.com',
  'wuuvo.com', 'xojxe.com', 'yevme.com', 'zippymail.info', 'nwytg.net', 'nwytg.com', 'mailinatorzz.mooo.com',
])

/** True when the address uses a known throwaway inbox service. */
export function isDisposableDomain(domain: string): boolean {
  const parts = domain.toLowerCase().trim().replace(/\.$/, '').split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true
  }
  return false
}
