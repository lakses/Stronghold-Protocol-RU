// Pick-one offer reminder (research 00 §3): the offer's cards themselves live in the shop bar (shopBar.js RewardCards —
// after a promotion, or a special refresh such as 凯瑟琳's «направленная поставка», they replace the bar's operator cards, like the
// original). When the player puts the pick off («выбрать позже») this pill above the bar brings the cards back; it names the
// offer like the bar's header (gameLogic.offerHeader: «Награда за повышение ожидает выбора» / «Направленная поставка ожидает выбора» …, player report #6 after 0.1.0), with
// "+N" while N more offers wait behind it, and disappears once the server clears `shop.rewardOffer` (picked, or the
// round ended).

import { html, Icon, TierChip } from './components.js';
import { offerHeader } from './gameLogic.js';

/**
 * @param {{ priv:any, minimized:boolean, onMinimize:(m:boolean)=>void }} props
 */
export function RewardOverlay({ priv, minimized, onMinimize }) {
  const offer = priv?.shop?.rewardOffer;
  if (!offer || !Array.isArray(offer.slots) || !offer.slots.length || !minimized) return null;
  const head = offerHeader(offer);
  return html`<button type="button" class="rewardpill" onClick=${() => onMinimize(false)}>
    <${Icon} name=${head.icon} /><span>${head.pill}</span>${Number.isInteger(offer.tier) ? html`<${TierChip} tier=${offer.tier} size="sm" />` : null}${head.queued ? html`<span class="rewardpill__more" title=${head.more}>+${head.queued}</span>` : null}
  </button>`;
}