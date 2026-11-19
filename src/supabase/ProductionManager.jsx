/** Roster must never land on the unrelated production-team manager. */
import React from 'react';
import ProductionManagerBase from './ProductionManagerBase';
import RepresentationAgreements from './RepresentationAgreements';
import {useRoleWorkspace} from './RoleWorkspaceContext';
export default function ProductionManager(props){const w=useRoleWorkspace();return w.tab==='roster'?<RepresentationAgreements {...props} role={w.role} preview={w.preview}/>:<ProductionManagerBase {...props}/>;}
