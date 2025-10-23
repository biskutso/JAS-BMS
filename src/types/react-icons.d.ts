import { FC, SVGAttributes } from 'react';

declare module 'react-icons' {
  export interface IconBaseProps extends SVGAttributes<SVGElement> {
    size?: string | number;
    color?: string;
    title?: string;
    className?: string;
  }
  
  export type IconType = FC<IconBaseProps>;
}

declare module 'react-icons/fa' {
  import { IconType } from 'react-icons';
  export const FaFacebookF: IconType;
  export const FaInstagram: IconType;
  export const FaTwitter: IconType;
}

declare module 'react-icons/io5' {
  import { IconType } from 'react-icons';
  export const IoCloseSharp: IconType;
}

declare module 'react-icons/gi' {
  import { IconType } from 'react-icons';
  export const GiHamburgerMenu: IconType;
}

declare module 'react-icons/md' {
  import { IconType } from 'react-icons';
  export const MdDashboard: IconType;
  export const MdListAlt: IconType;
  export const MdCalendarToday: IconType;
  export const MdHistory: IconType;
  export const MdNotifications: IconType;
  export const MdEventAvailable: IconType;
  export const MdSettings: IconType;
  export const MdStore: IconType;
  export const MdPeople: IconType;
  export const MdReport: IconType;
}