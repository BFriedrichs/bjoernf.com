export const isDev = import.meta.env.DEV;

export const isSSR = typeof window === 'undefined';

export const getFileUrl = (fileName) => `https://bjornf.dev/${fileName}`;

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const formatDate = (tstamp) => {
  const date = new Date(tstamp * 1000);
  const day = date.getDay();
  const month = date.getMonth();
  const year = date.getFullYear();

  let dayAddon = 'th';
  if (day === 1) {
    dayAddon = 'st';
  } else if (day === 2) {
    dayAddon = 'nd';
  } else if (day === 3) {
    dayAddon = 'rd';
  }

  return `${months[month]} ${day}${dayAddon}, ${year}`;
};