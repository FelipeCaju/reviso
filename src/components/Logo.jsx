import { Image as ImgCmp } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6aa29ae2c83b44fa65bdbaa2/ec82de91e_Gemini_Generated_Image_6kx4ul6kx4ul6kx4.jpg";

export default function Logo({ className = "" }) {
  return (
    <ImgCmp
      src={LOGO_URL}
      alt="Revisô"
      fittingType="fit"
      className={`rounded-xl ${className}`}
    />
  );
}