export const resources = Object.freeze({
  seat: {title:'Seat changes',icon:'seat-changes',intro:'Passengers who need a different seat can compensate someone willing to move.',earn:'Accept a suitable seat change that helps another passenger.',use:'Request a seat arrangement that better meets your needs.',allocation:'Flex coordinates the affected passengers and their seating conditions.'},
  flight: {title:'Flight changes',icon:'flight-changes',intro:'Different schedules create opportunities to connect people who need another flight with those who can travel at a different time.',earn:'Accept a suitable flight change for a passenger request or a Cathay incentive.',use:'Request another flight within the dates and conditions you can accept.',allocation:'Flex checks passenger conditions and flight capacity together.'},
  baggage: {title:'Baggage allowance',icon:'checked-baggage',intro:'Unused allowance and lighter packing can create value, while other travellers may need more baggage capacity.',earn:'Release eligible allowance or receive a reward for verified lighter packing under Cathay’s rules.',use:'Add baggage allowance for the journey where you need it.',allocation:'Cathay adjusts allowance and verifies qualifying contributions.'},
  meal: {title:'Meal choice',icon:'meal-choice',intro:'An early meal decline gives Cathay time to prepare and load fewer unwanted meals.',earn:'Decline an eligible main meal before the catering deadline.',use:null,allocation:'Cathay updates its catering plan and rewards the qualifying release.'},
  upgrade: {title:'Cabin upgrades',icon:'cabin-upgrade',intro:'Flex Credits can make remaining premium-cabin capacity useful to passengers.',earn:null,use:'Request an upgrade, confirmed near departure if eligible capacity remains.',allocation:'Cathay confirms the upgrade against remaining cabin availability.'},
  neighbour: {title:'Neighbour-free seat',icon:'neighbour-free-seat',intro:'A seat beside you can remain empty when the flight has suitable capacity.',earn:null,use:'Request extra space beside your seat, confirmed if capacity remains.',allocation:'Cathay checks the seating arrangement and availability near departure.'},
  lounge: {title:'Lounge access',icon:'lounge-access',intro:'Credits earned from a useful change can become a more comfortable wait at the airport.',earn:null,use:'Redeem credits for access to an eligible lounge on your journey.',allocation:'Access is issued within lounge availability.'},
  wifi: {title:'Inflight Wi-Fi',icon:'inflight-wifi',intro:'Value earned through flexibility can keep you connected on a later flight.',earn:null,use:'Redeem credits for an eligible inflight Wi-Fi service.',allocation:'Access depends on the services available on the flight.'}
});
export const journey = Object.freeze({startingBalance:600,seatReward:160,seatCost:160,baggageCost:200});
export function journeyAt(value) {
  const step=Number.isFinite(value)?Math.min(3,Math.max(0,Math.trunc(value))):0;
  const cost=journey.seatCost+journey.baggageCost;
  return Object.freeze({step,balance:journey.startingBalance+(step>=1?journey.seatReward:0)-(step===3?cost:0),cost,earned:step>=1,fulfilled:step===3});
}
export function nextJourney(value){return journeyAt(value===3?0:value+1)}
export function previousJourney(value){return journeyAt(value-1)}
