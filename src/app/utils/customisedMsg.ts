/* eslint-disable @typescript-eslint/no-explicit-any */
const customizedMsg = (result: any, item: string) => {
  const text = item;
  const chars = text.split(''); // Split into an array of characters
  chars.pop(); // Remove the last element from the array
  const oneitem = chars.join(''); // Concatenate the remaining characters into a string

  if (Object.keys(result).length > 1) {
    return `${Object.keys(result).length} ${item} ${Object.keys(result).length > 1 ? 'have' : 'has'} been retrieved`;
  } else if (Object.keys(result).length === 1) {
    return `${Object.keys(result).length} ${oneitem} has been retrieved`;
  } else return `No such ${oneitem} found in DB`;
};

export default customizedMsg;
