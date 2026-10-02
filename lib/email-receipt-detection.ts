export function looksLikeEmailReceipt(subject: string, text: string) {
  const normalizedSubject = subject.toLowerCase();
  const sample = text.toLowerCase();
  const subjectSignalsReceipt =
    /\b(receipt|invoice|order (received|confirmation|confirmed|summary)|your order .* (placed|confirmed)|thanks? for (your )?order|purchase confirmation|your purchases? from|ordered \d+|trip with uber)\b/.test(
      normalizedSubject,
    );
  const hasTotal = /\b(total|amount paid|order total)\b/.test(sample);
  const hasBreakdown = /\b(subtotal|tax|tip|payment method)\b/.test(sample);
  const hasOrderNumber =
    /\b(order|confirmation)\s*(number|no\.?|#)|\border number\b/.test(sample);
  const hasMoney = /\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})\b/.test(sample);
  const hasPayment =
    /\b(visa|mastercard|amex|discover|credit card|paypal|apple pay)\b/.test(
      sample,
    );
  const hasFulfillment = /\b(for pickup|delivery|ordered from|items?)\b/.test(
    sample,
  );

  const bodyEvidence = [
    hasTotal,
    hasBreakdown,
    hasOrderNumber,
    hasMoney,
    hasPayment,
    hasFulfillment,
  ].filter(Boolean).length;

  return (
    (subjectSignalsReceipt && hasMoney && bodyEvidence >= 3) ||
    (hasOrderNumber && hasTotal && hasMoney && (hasPayment || hasBreakdown))
  );
}
