export const euclidianDistance = (x1, y1, x2, y2) => {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }
  
  export const calculateSlope = (x1, y1, x2, y2) => {
    return (y2 - y1) / (x2 - x1);
  }
  