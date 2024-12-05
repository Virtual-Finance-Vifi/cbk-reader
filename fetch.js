function getCurrentKenyanDate() {
  // Get current date in UTC
  const now = new Date();

  // Format the date as DD/MM/YYYY
  const day = String(now.getUTCDate()).padStart(2, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = now.getUTCFullYear();
  const formattedDate = encodeURIComponent(`${day}/${month}/${year}`);

  return `04%2F12%2F2024~04%2F12%2F2024`; //`${formattedDate}~${formattedDate}`;
}

fetch(
  "https://www.centralbank.go.ke/wp-admin/admin-ajax.php?action=get_wdtable&table_id=193",
  {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: `draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=date_r&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=${getCurrentKenyanDate()}&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=currency&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=US+DOLLAR&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=ROUND(jx_views_fx_new_rates.mean%2C4)&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&start=0&length=25&search%5Bvalue%5D=&search%5Bregex%5D=false&sRangeSeparator=~`,
    method: "POST",
  }
)
  .then((response) => response.text()) // Parse JSON once
  .then((data) => {
    //console.log(data);

    // Use a regex to extract the US Dollar rate
    const regex = /\"data\":\[\[\".*?\\\/.*?\\\/.*?\",\".*?\",\".*?\"\]\]/;
    const match = data.match(regex);

    if (match) {
      console.log(match[0]);
    } else {
      console.log("US Dollar Rate not found.");
    }
  })
  .catch((error) => console.error("Error:", error));
