// Steam CDN image paths for every item the demo shows (portfolio, trades and
// Snipes examples), copied from public/items.json. Built in so demo images
// load straight away instead of waiting for the 9 MB items.json download.
// Add a line here when you add an item to a demo list (the test checks).
const STEAM_IMG = 'https://community.akamai.steamstatic.com/economy/image/';

const PATHS = {
  "AK-47 | Asiimov (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSIeOaB2qf19F7teVgWiT9x01x623cmd2rcXKQbw4oA8dzReEK5EK6kNO2NOO04FeIjYJCmyr4jzQJsHiu1I77Gg",
  "AK-47 | Bloodsport (Minimal Wear)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiVI0POlPPNSIvycAWOD0eFkpN5lRi67gVN15mmDw9egci_EPFAkDMQlTeZe4EXplNa0Yrvr5wbd345GyHioiC4b8G81tFuqg_k_",
  "AK-47 | Fuel Injector (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiVI0POlPPNSM-WDC3WTye9kt-RtcCS2kRQyvnPczdutIHzCPQ52DZV2TbIOshG7ltOyM7vg71GPioMUmHr6iyxJ6C5o_a9cBpypIj3h",
  "AK-47 | Neon Rider (Minimal Wear)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlV6poL_6sHG6UxPxJvOhuRz39xkQhsTnVzoygdy7Ea1UoCZQkRe9bs0brl9TvN-m0tVHYjY5CyS35jjQJsHhk4o5zcA",
  "AK-47 | Redline (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzOtyufRkASq2lkxx4W-HnNyqJC3FZwYoC5p0Q7FfthW6wdWxPu-371Pdit5HnyXgznQeHYY5wyA",
  "AK-47 | Slate (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiVI0POlPPNSMOKcCGKD0ud5vuBlcCS2kRQyvnOGw4r_d3OWZ1MnCpBwR-Rc5hbumtCzP-Kw7wSIiYsRnHr2i35MvS1s_a9cBkIkkRA2",
  "AK-47 | Vulcan (Minimal Wear)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSMuWRDGKC_uJ_t-l9AXCxxEh14zjTztivci2ePQZ2W8NzTecD4BKwloLiYeqxtAOIj9gUyyngznQeF7I6QE8",
  "AWP | Asiimov (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ",
  "AWP | Atheris (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V7JkMPWBMWqVxedjva85Girklhl2sWuAmYusICqWbQJxCcclRe4C4Ba5ldOyYeri7gKLg95E02yg2f7FnVOo",
  "AWP | Chromatic Aberration (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6dlMv-eD1iAyOB9j-xsSyCmmFNz4WXTz4n6cHyUbQ50D5AiF-Ne4ES9m9K1MePq4leKjYlGyX363S0d8G81tKSnYp_g",
  "AWP | Hyper Beast (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6x0MPWBMWWVwP1ij-xsSyCmmFMj62Tcwt-gJC_BbwNyDZokQu8I4BK6wdazMuq35AbW3YIWmy_4h3tO8G81tKCz9TDP",
  "AWP | Neo-Noir (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6poL_6cB3WvzOtyufRkAS3rwE4h5D-Am939eXrGa1d1DJMlRe8Dshi-ltPvNbjr5AfWiIhHyX3gznQey5gGLwk",
  "Desert Eagle | Blaze (Factory New)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU",
  "Desert Eagle | Code Red (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk6OGRbKFsJ_yWMWaXxvxzo_JmXRa-kBkupjDLzd2qIH_DPQcpA8YjFuQP50a7moKyMuK35QyK3t0WnC75iC5B53w-5PFCD_THYZfD3g",
  "Desert Eagle | Printstream (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7OeRbKFsJ8-DHG6e1f1iouRoQha-kBkupjDLz9_6c3mWPFBxX8N0EOMIsULpmtHjPuvq41bc2dhAzy3_2ngfvHpt5_FCD_RJLjxjaQ",
  "Glock-18 | Fade (Factory New)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1a7s2oaaBoH_yaCW-Ej-8u5bZvHnq1w0Vz62TUzNj4eCiVblMmXMAkROJeskLpkdXjMrzksVTAy9US8PY25So",
  "M4A1-S | Hyper Beast (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_OGMWrEwL9JuPh5SjuMlxgmoCm6l4r9KD7KcA50WcR0R7NctBm_k9fgN7nn4FGMitpCxH-vjikc6Cs4t-5TVaMgr_bJz1aWEz9VGgc",
  "M4A1-S | Player Two (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_OGMWrEwL9lj-J6SCbhxUl_jDCAnobsLGWUPQ4hDZBwRuQM40S8w9zmYu3l4VHaio8TyCT62yhPuydq4b4EVPJw5OSJ2Jt3xOmm",
  "M4A1-S | Printstream (Minimal Wear)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_OGMWrEwL9lj_F7Rienhgk1tjyIpYPwJiPTcAAoCpsiEO5ZsUbpm9C2Zuni4VHW3o5EzSX62HxP7Sg96-hWVqYi_6TJz1aW0nxrkGs",
  "M4A4 | Neo-Noir (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiFO0P_6afBSLvWcMWmfyPxJveRtRjy-2xh15D7dyN_9In7GaQN1C5V2QrReuhLtm9TlZb-w7gzbiY8Uyn_5jXlXrnE8Rz2LjAE",
  "M4A4 | The Emperor (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiVI0P_6afBSJf2DC3Wf09F7teVgWiT9kEtxsW_dntepcn2SZgF1CcN3RORe4RTtlN2yYenh7wPXiYxDmS_22jQJsHjOUN0CaQ",
  "StatTrak™ AK-47 | Redline (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzOtyufRkASq2lkxx4W-HnNyqJC3FZwYoC5p0Q7FfthW6wdWxPu-371Pdit5HnyXgznQeHYY5wyA",
  "USP-S | Kill Confirmed (Minimal Wear)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkjYbf7itX6vytbbZSI-WsG3SA_uV_vO1WTCa9kxQ1vjiBpYPwJiPTcFB2Xpp5TO5cskG9lYCxZu_jsVCL3o4Xnij23ClO5ik9tegFA_It8qHJz1aWe-uc160",
  "USP-S | Neo-Noir (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkjYbf7itX6vytbbZSI-WsG3SA0tF4v-h7cCS2kRQyvnOHzNyuJCqUbwMlAptxReQM5kO6m9WxM-vm5QePgtgRyi-q3ChM6Sps_a9cBssX5EAo",
  "USP-S | Printstream (Minimal Wear)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkjYbf7itX6vytbbZSI-WsG3SA_v5kue99XD2hkBwqjDGMnYftb3yUPFR0XsNyRrNc5kO5ltziMenr5lONj4kXyi2riywc7y9o5LtQAqQ7uvqAkScWnv4",
  "★ Butterfly Knife | Doppler (Factory New)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Z-ua6bbZrLOmsD2qv0u9moOlgXSyMmBw1sTGAk5X8JRTFAVp5Xco0W-ENtRXswYC1Mu_ks1fdjN9EyiqthiMbvHtv5btQBPck-KbT2gnHM-Ajoc5Ufn65u8U",
  "★ Butterfly Knife | Fade (Factory New)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Z-ua6bbZrLOmsD2avx-9ytd5lRi67gVNwsDvSwtqqc3iXZg4kCZYjReYLtRbum9XgYuvm5wbWjtgUzCn3iSsf8G81tFEeH9rw",
  "★ Karambit | Doppler (Factory New)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Q7uCvZaZkNM-SA1iDwP5muOh7Sha-lA8lvziMgIr9HifOOV5kFMRxFuEM5hi_xNXhMbmx5VCMjd9MyCv6jigc6n064ucLAvZ3_6bViV3fcepqpLtspE0",
  "★ M9 Bayonet | Lore (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Wts2sab1iLvWHMWSF_uMvj-NoVha_mg8ijDCAnobsLGWebgVzA5EjQrMJ40G9xIHhMu_j4wOM2oJMnCuq2nlN73w54OdRVqoj5OSJ2HZV8Guh",
  "★ Skeleton Knife | Case Hardened (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1I5PeibbBiLs-SH1ifyOJztN5kSi26gBBptjuAyN74In3FbwB1XMR4QLMP4UWwloLmPr7rtAaKi9pMzC6r3H5M6DErvbi2ERQIPw",
  "★ Specialist Gloves | Fade (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Tk71ruQBH4jYLf-i5U-fe9V7d9JfOaD2uZ0vpJtuBtSha-kBkupjDLzt6hdX3GaQApXpZyQ-UCtRG7xIHkN-q2sgTajYIQyS35iHhLv31jsfFCD_Sz6qyOzg",
  "★ Sport Gloves | Vice (Field-Tested)":
    "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Tk5UvzWCL2kpn2-DFk_OKherB0H_KfG2Kv0ed4u95kSi26gBBp6jvcyY34J3jGZw51CJt1R-Beuxfqk4fhPu7n5VTY2tpHn3343y5P6DErvbh5izSzPA",
};

// Bare icon path, the form the Trades page expects (it adds the CDN prefix).
export const demoIconPath = (name) => PATHS[name] || null;

// Full image URL, the form portfolio items and Snipes deals use.
export const demoImage = (name) => (PATHS[name] ? `${STEAM_IMG}${PATHS[name]}/256fx256f` : null);

export const DEMO_IMAGE_NAMES = Object.keys(PATHS);
