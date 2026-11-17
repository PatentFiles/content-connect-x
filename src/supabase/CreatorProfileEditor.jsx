/** Preserve the creator editor; professionals and role previews have separate layouts. */
import React from 'react';
import CreatorProfileEditorBase from './CreatorProfileEditorBase';
import CreatorProfilePreview from './CreatorProfilePreview';
import ProfessionalProfileEditor from './ProfessionalProfileEditor';
import RosterPanel from './RosterPanel';
import {profileWithDisplayRegion} from './roleWorkspacePolicy.mjs';
import {useRoleWorkspace} from './RoleWorkspaceContext';
export default function CreatorProfileEditor(props){
 const workspace=useRoleWorkspace();
 const role=workspace.role||props.profile?.role_type||'creator';
 const profile=profileWithDisplayRegion(props.profile);
 const approved=workspace.account?workspace.account.age_verified===true:props.approved&&!props.isAdmin;
 if(role!=='creator')return <ProfessionalProfileEditor key={role} {...props} approved={approved} profile={profile} role={role} preview={workspace.preview}/>;
 if(workspace.preview)return <CreatorProfilePreview/>;
 return <><CreatorProfileEditorBase {...props} approved={approved} profile={profile}/>{workspace.account?.onboarding_complete===true&&<section className="mx-auto mt-6 max-w-4xl px-4"><RosterPanel compact user={props.user} role="creator"/></section>}</>;
}
