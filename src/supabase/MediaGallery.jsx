/** Professional portfolios are separate from the unchanged media/gallery module. */
import React from 'react';
import MediaGalleryBase from './MediaGalleryBase';
import ProfessionalPortfolio from './ProfessionalPortfolio';
import {useRoleWorkspace} from './RoleWorkspaceContext';
export default function MediaGallery(props){const w=useRoleWorkspace();return w.tab==='portfolio'?<ProfessionalPortfolio {...props} role={w.role} preview={w.preview}/>:<MediaGalleryBase {...props}/>;}
