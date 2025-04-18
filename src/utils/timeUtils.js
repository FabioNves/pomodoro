export const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} | ${hours}:${minutes}`;
};

export const formatDatee = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

export const todayDate = new Date().toLocaleDateString();

export const yesterdayDate = new Date(
  new Date().setDate(new Date().getDate() - 1)
).toLocaleDateString();
