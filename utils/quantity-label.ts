export function quantityLabel(
  count: number,
  one: string,
  few: string,
  many: string,
) {
  const value = Math.abs(count);
  const form =
    value % 100 >= 11 && value % 100 <= 14
      ? many
      : value % 10 === 1
        ? one
        : value % 10 >= 2 && value % 10 <= 4
          ? few
          : many;
  return `${count} ${form}`;
}
