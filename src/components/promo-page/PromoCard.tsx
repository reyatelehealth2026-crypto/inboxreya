import type { PromoCard as PromoCardData } from '@/lib/cny-news-promo'
import type { PromoOffer } from '@/lib/cny-promo-offers'

/**
 * One card on /promo. The artwork already states the promo, so below it there is
 * only the short name, the store price when known, and the chat strip for partners.
 */
export function PromoCard({
  id,
  card,
  offer,
  chatUrl,
}: {
  id: string
  card: PromoCardData
  offer: PromoOffer
  chatUrl: string | null
}) {
  const image = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={card.imageUrl}
      alt={offer.brand || card.partner || ''}
      loading="lazy"
      decoding="async"
      className="ph-card-img"
    />
  )

  return (
    <div id={id} className={card.wide ? 'ph-card ph-card-wide' : 'ph-card'}>
      {card.href ? <a href={card.href}>{image}</a> : image}
      {offer.brand && (
        <div className="ph-card-body">
          <div className="ph-card-brand">{offer.brand}</div>
        </div>
      )}
      {offer.price && (
        <a href={card.href ?? undefined} className="ph-price">
          <span className="ph-price-big">{offer.price}</span>
          {offer.unitLine && <span className="ph-price-unit">{offer.unitLine}</span>}
          {offer.off && <span className="ph-price-off">{offer.off}</span>}
        </a>
      )}
      {chatUrl && (
        <a href={chatUrl} className="ph-chat">
          สั่งผ่านแชท
        </a>
      )}
    </div>
  )
}
