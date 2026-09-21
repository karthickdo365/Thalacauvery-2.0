import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PersonIcon from "@mui/icons-material/Person";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LanguageIcon from "@mui/icons-material/Language";
import SaveIcon from "@mui/icons-material/Save";

const BigMachine = () => {
  const [agent, setAgent] = useState({
    name: "",
    jInner: "",
    outer: "",
    depth: "",
    trans: "",
  });

  const [items, setItems] = useState({
    diesel: {
      quantity: "",
      rate: "",
    },
    jPipe: {
      quantity: "",
      rate: "",
    },
    outer: {
      quantity: "",
      rate: "",
    },
    bit: {
      quantity: "",
      rate: "",
    },
    hammer: {
      quantity: "",
      rate: "",
    },
    other: {
      value: "",
      rate: "",
    },
  });

  const [languages, setLanguages] = useState({
    tamil: false,
    hindi1: false,
    hindi2: false,
    hindi3: false,
  });

  // ============================================================
  // AGENT
  // ============================================================

  const handleAgentChange = (field, value) => {
    setAgent((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ============================================================
  // ITEMS
  // ============================================================

  const handleItemChange = (item, field, value) => {
    setItems((prev) => ({
      ...prev,
      [item]: {
        ...prev[item],
        [field]: value,
      },
    }));
  };

  // ============================================================
  // AMOUNT
  // ============================================================

  const getAmount = (item) => {
    const quantity = Number(item?.quantity) || 0;
    const rate = Number(item?.rate) || 0;

    return quantity * rate;
  };

  // ============================================================
  // ITEM TOTAL
  // ============================================================

  const totalItemAmount = useMemo(() => {
    return (
      getAmount(items.diesel) +
      getAmount(items.jPipe) +
      getAmount(items.outer) +
      getAmount(items.bit) +
      getAmount(items.hammer)
    );
  }, [items]);

  // ============================================================
  // AGENT TOTAL
  // ============================================================

  const agentTotal = useMemo(() => {
    const jInner = Number(agent.jInner) || 0;
    const outer = Number(agent.outer) || 0;
    const depth = Number(agent.depth) || 0;
    const trans = Number(agent.trans) || 0;

    return jInner + outer + depth + trans;
  }, [agent]);

  // ============================================================
  // LANGUAGE
  // ============================================================

  const handleLanguageChange = (language) => {
    setLanguages((prev) => ({
      ...prev,
      [language]: !prev[language],
    }));
  };

  // ============================================================
  // SAVE
  // ============================================================

  const handleSave = () => {
    const formData = {
      machineType: "big",
      agent,
      items,
      languages,
      agentTotal,
      totalItemAmount,
    };

    console.log("BIG MACHINE FORM DATA:", formData);

    alert("Big Machine data saved successfully");
  };

  // ============================================================
  // FORMAT
  // ============================================================

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString("en-IN");
  };

  // ============================================================
  // COLORS
  // ============================================================

  const colors = {
    primary: "#1769e0",
    primaryDark: "#12366b",
    border: "#c9def7",
    lightBlue: "#f2f7fd",
    amountBg: "#f0f6ff",
    text: "#102f5f",
    secondaryText: "#45658f",
  };

  // ============================================================
  // COMMON STYLES
  // ============================================================

  const sectionStyle = {
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    overflow: "hidden",
    background: "#fff",
    marginBottom: "26px",
    boxShadow: "none",
  };

  const sectionHeaderStyle = {
    minHeight: "66px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "0 24px",
    background:
      "linear-gradient(90deg, #f2f8ff 0%, #f8fbff 100%)",
    borderBottom: `1px solid ${colors.border}`,
  };

  const sectionIconStyle = {
    width: "36px",
    height: "36px",
    color: colors.primary,
  };

  const labelStyle = {
    color: colors.text,
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "7px",
  };

  const inputStyle = {
    "& .MuiOutlinedInput-root": {
      minHeight: "50px",
      borderRadius: "6px",
      backgroundColor: "#fff",
      fontSize: "18px",
      color: colors.text,

      "& fieldset": {
        borderColor: "#bfd4ee",
        borderWidth: "1px",
      },

      "&:hover fieldset": {
        borderColor: colors.primary,
      },

      "&.Mui-focused fieldset": {
        borderColor: colors.primary,
        borderWidth: "2px",
      },
    },

    "& .MuiInputBase-input": {
      padding: "12px 16px",
      color: colors.text,
    },
  };

  const amountStyle = {
    "& .MuiOutlinedInput-root": {
      minHeight: "50px",
      borderRadius: "6px",
      backgroundColor: colors.amountBg,

      "& fieldset": {
        borderColor: "#cfe2f8",
      },

      "&:hover fieldset": {
        borderColor: colors.primary,
      },

      "&.Mui-focused fieldset": {
        borderColor: colors.primary,
      },
    },

    "& .MuiInputBase-input": {
      padding: "12px 16px",
      color: colors.primary,
      fontSize: "19px",
      fontWeight: 700,
    },
  };

  // ============================================================
  // ITEM ROW
  // ============================================================

  const ItemRow = ({
    name,
    itemKey,
  }) => {
    const item = items[itemKey];

    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "1.1fr 1fr 1fr 1fr",
          },
          gap: {
            xs: 1,
            md: 0,
          },
          alignItems: "center",
          minHeight: "82px",
          px: 2,
          borderLeft: "1px solid #d8e7f7",
          borderRight: "1px solid #d8e7f7",
          borderBottom: "1px solid #d8e7f7",
        }}
      >
        <Typography sx={itemNameStyle}>
          {name}
        </Typography>

        <TextField
          label="Quantity"
          type="number"
          value={item.quantity}
          onChange={(e) =>
            handleItemChange(
              itemKey,
              "quantity",
              e.target.value
            )
          }
          sx={inputStyle}
        />

        <TextField
          label="Rate"
          type="number"
          value={item.rate}
          onChange={(e) =>
            handleItemChange(
              itemKey,
              "rate",
              e.target.value
            )
          }
          sx={inputStyle}
        />

        <TextField
          value={formatNumber(getAmount(item))}
          InputProps={{
            readOnly: true,
          }}
          sx={amountStyle}
        />
      </Box>
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#fff",
        color: colors.text,
      }}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <Box
        sx={{
          height: "82px",
          borderBottom: "1px solid #dce9f7",
          display: "flex",
          alignItems: "center",
          px: {
            xs: 2,
            md: 4,
          },
          gap: 2,
          background: "#fff",
        }}
      >
        <Box
          sx={{
            width: "42px",
            height: "42px",
            borderRadius: "7px",
            background:
              "linear-gradient(135deg, #2d86ee, #1769e0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <MenuIcon />
        </Box>

        <Typography
          sx={{
            fontSize: {
              xs: "22px",
              md: "28px",
            },
            fontWeight: 700,
            color: colors.primaryDark,
          }}
        >
          Agent Details
        </Typography>

        <Box
          sx={{
            width: "1px",
            height: "28px",
            background: "#a9c4e5",
            mx: 1,
          }}
        />

        <Typography
          sx={{
            fontSize: {
              xs: "17px",
              md: "22px",
            },
            color: colors.secondaryText,
            fontWeight: 500,
          }}
        >
          Data Entry Form
        </Typography>

        <Box sx={{ flex: 1 }} />

        <CalendarMonthIcon
          sx={{
            color: colors.secondaryText,
            display: {
              xs: "none",
              sm: "block",
            },
          }}
        />

        <Typography
          sx={{
            color: colors.text,
            fontSize: "16px",
            display: {
              xs: "none",
              sm: "block",
            },
          }}
        >
          Today
        </Typography>

        <Box
          sx={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#e8f1fc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#55779e",
          }}
        >
          <PersonIcon />
        </Box>
      </Box>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <Box
        sx={{
          maxWidth: "1100px",
          margin: "28px auto",
          px: {
            xs: 2,
            md: 0,
          },
        }}
      >
        {/* ====================================================
            AGENT INFORMATION
        ==================================================== */}

        <Paper sx={sectionStyle}>
          <Box sx={sectionHeaderStyle}>
            <PersonIcon sx={sectionIconStyle} />

            <Typography
              sx={{
                fontSize: "26px",
                fontWeight: 700,
                color: colors.text,
              }}
            >
              Agent Information
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            <Typography sx={labelStyle}>
              Agent
            </Typography>

            <TextField
              fullWidth
              value={agent.name}
              onChange={(e) =>
                handleAgentChange(
                  "name",
                  e.target.value
                )
              }
              sx={inputStyle}
            />

            <Grid
              container
              spacing={3}
              sx={{
                mt: 0.5,
              }}
            >
              <Grid item xs={12} sm={6} md={3}>
                <Typography sx={labelStyle}>
                  J Inner
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={agent.jInner}
                  onChange={(e) =>
                    handleAgentChange(
                      "jInner",
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography sx={labelStyle}>
                  Outer
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={agent.outer}
                  onChange={(e) =>
                    handleAgentChange(
                      "outer",
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography sx={labelStyle}>
                  Depth
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={agent.depth}
                  onChange={(e) =>
                    handleAgentChange(
                      "depth",
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography sx={labelStyle}>
                  Trans
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={agent.trans}
                  onChange={(e) =>
                    handleAgentChange(
                      "trans",
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />
              </Grid>
            </Grid>

            <Box
              sx={{
                mt: 3,
                minHeight: "58px",
                borderRadius: "6px",
                background: "#f0f6fd",
                border: "1px solid #d7e7f8",
                display: "flex",
                alignItems: "center",
                px: 2,
              }}
            >
              <Typography
                sx={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: colors.text,
                }}
              >
                Total
              </Typography>

              <Box sx={{ flex: 1 }} />

              <Typography
                sx={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: colors.primary,
                }}
              >
                {formatNumber(agentTotal)}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* ====================================================
            ITEM DETAILS
        ==================================================== */}

        <Paper sx={sectionStyle}>
          <Box sx={sectionHeaderStyle}>
            <Inventory2Icon sx={sectionIconStyle} />

            <Typography
              sx={{
                fontSize: "26px",
                fontWeight: 700,
                color: colors.text,
              }}
            >
              Item Details
            </Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: {
                  xs: "none",
                  md: "grid",
                },
                gridTemplateColumns:
                  "1.1fr 1fr 1fr 1fr",
                minHeight: "48px",
                alignItems: "center",
                background: "#f0f6fd",
                border: "1px solid #d8e7f7",
                borderRadius: "6px 6px 0 0",
                px: 2,
              }}
            >
              <Typography sx={tableHeaderStyle}>
                Item
              </Typography>

              <Typography sx={tableHeaderStyle}>
                Quantity
              </Typography>

              <Typography sx={tableHeaderStyle}>
                Rate
              </Typography>

              <Typography sx={tableHeaderStyle}>
                Amount
              </Typography>
            </Box>

            <ItemRow
              name="Diesel"
              itemKey="diesel"
            />

            <ItemRow
              name="JPipe"
              itemKey="jPipe"
            />

            <ItemRow
              name="Outer"
              itemKey="outer"
            />

            <ItemRow
              name="Bit"
              itemKey="bit"
            />

            <ItemRow
              name="Hammer"
              itemKey="hammer"
            />

            {/* OTHER */}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "1.1fr 1fr 1fr 1fr",
                },
                gap: {
                  xs: 1,
                  md: 0,
                },
                alignItems: "center",
                minHeight: "82px",
                px: 2,
                borderLeft: "1px solid #d8e7f7",
                borderRight: "1px solid #d8e7f7",
                borderBottom: "1px solid #d8e7f7",
              }}
            >
              <Typography sx={itemNameStyle}>
                Other
              </Typography>

              <TextField
                placeholder="Balance"
                value={items.other.value}
                onChange={(e) =>
                  handleItemChange(
                    "other",
                    "value",
                    e.target.value
                  )
                }
                sx={{
                  ...inputStyle,
                  gridColumn: {
                    xs: "auto",
                    md: "span 2",
                  },
                }}
              />

              <TextField
                value=""
                InputProps={{
                  readOnly: true,
                }}
                sx={amountStyle}
              />
            </Box>

            {/* AMT */}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "1.1fr 1fr 1fr 1fr",
                },
                alignItems: "center",
                minHeight: "74px",
                px: 2,
                borderLeft: "1px solid #d8e7f7",
                borderRight: "1px solid #d8e7f7",
                borderBottom: "1px solid #d8e7f7",
                borderRadius: "0 0 6px 6px",
              }}
            >
              <Typography
                sx={{
                  ...itemNameStyle,
                  gridColumn: {
                    xs: "auto",
                    md: "span 3",
                  },
                }}
              >
                AMT
              </Typography>

              <TextField
                value={formatNumber(totalItemAmount)}
                InputProps={{
                  readOnly: true,
                }}
                sx={amountStyle}
              />
            </Box>
          </Box>
        </Paper>

        {/* ====================================================
            LANGUAGE
        ==================================================== */}

        <Paper sx={sectionStyle}>
          <Box sx={sectionHeaderStyle}>
            <LanguageIcon sx={sectionIconStyle} />

            <Typography
              sx={{
                fontSize: "26px",
                fontWeight: 700,
                color: colors.text,
              }}
            >
              Language
            </Typography>
          </Box>

          <Box
            sx={{
              p: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                md: "repeat(4, 1fr)",
              },
              gap: 1,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={languages.tamil}
                  onChange={() =>
                    handleLanguageChange("tamil")
                  }
                  sx={checkboxStyle}
                />
              }
              label="Tamil"
              sx={languageLabelStyle}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={languages.hindi1}
                  onChange={() =>
                    handleLanguageChange("hindi1")
                  }
                  sx={checkboxStyle}
                />
              }
              label="Hindi 1"
              sx={languageLabelStyle}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={languages.hindi2}
                  onChange={() =>
                    handleLanguageChange("hindi2")
                  }
                  sx={checkboxStyle}
                />
              }
              label="Hindi 2"
              sx={languageLabelStyle}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={languages.hindi3}
                  onChange={() =>
                    handleLanguageChange("hindi3")
                  }
                  sx={checkboxStyle}
                />
              }
              label="Hindi 3"
              sx={languageLabelStyle}
            />
          </Box>
        </Paper>

        {/* ====================================================
            SAVE
        ==================================================== */}

        <Button
          fullWidth
          variant="contained"
          onClick={handleSave}
          startIcon={<SaveIcon />}
          sx={{
            height: "62px",
            borderRadius: "7px",
            background:
              "linear-gradient(90deg, #287ee7 0%, #1976e8 100%)",
            fontSize: "21px",
            fontWeight: 700,
            textTransform: "none",
            boxShadow: "none",

            "&:hover": {
              background:
                "linear-gradient(90deg, #1e70d7 0%, #1267d5 100%)",
              boxShadow: "none",
            },
          }}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};

// ============================================================
// STYLES
// ============================================================

const itemNameStyle = {
  fontSize: "19px",
  fontWeight: 700,
  color: "#102f5f",
  py: 1,
};

const tableHeaderStyle = {
  fontSize: "18px",
  fontWeight: 700,
  color: "#49688f",
};

const checkboxStyle = {
  color: "#7c9bc0",

  "&.Mui-checked": {
    color: "#1769e0",
  },
};

const languageLabelStyle = {
  "& .MuiFormControlLabel-label": {
    fontSize: "18px",
    color: "#102f5f",
  },
};

export default BigMachine;
